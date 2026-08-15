import { Types } from 'mongoose';
import { getModel, Order, User } from '../models/index.js';
import { createHttpError } from '../utils/error.js';
import {
  buildMongoFilter,
  combineFilters,
  normalizeDoc,
  parseSelect,
  parseSort,
} from '../utils/dbHelpers.js';
import { isAdmin, isWholesaler, requireAuth } from '../middleware/auth.js';
import { autoAssignDeliveryAgent } from './dispatchService.js';

export const getReadScope = async (table, auth, filters) => {
  const baseFilter = buildMongoFilter(filters);

  switch (table) {
    case 'profiles':
      requireAuth(auth);
      const profileId = Types.ObjectId.isValid(auth.sub) ? new Types.ObjectId(auth.sub) : auth.sub;
      return isAdmin(auth) ? baseFilter : combineFilters(baseFilter, { _id: profileId });
    case 'products':
    case 'spare_parts':
      if (isAdmin(auth)) return baseFilter;
      if (!auth?.sub) return combineFilters(baseFilter, { is_approved: true });
      return combineFilters(baseFilter, { $or: [{ is_approved: true }, { seller_id: auth.sub }] });
    case 'sell_requests':
    case 'repair_bookings':
    case 'orders': {
      if (!auth?.sub) return baseFilter;
      if (isAdmin(auth)) return baseFilter;
      const userMatch = Types.ObjectId.isValid(auth.sub)
        ? { $or: [{ user_id: auth.sub }, { user_id: new Types.ObjectId(auth.sub) }] }
        : { user_id: auth.sub };
      return combineFilters(baseFilter, userMatch);
    }
    case 'sell_price_configs':
      return isAdmin(auth) ? baseFilter : combineFilters(baseFilter, { is_active: true });
    case 'dispatches': {
      if (!auth?.sub) return baseFilter;
      if (isAdmin(auth)) return baseFilter;
      const orders = await Order.find({ user_id: auth.sub }).select('_id');
      const orderIds = orders.map((order) => order._id.toString());
      return combineFilters(baseFilter, { order_id: { $in: orderIds } });
    }
    case 'delivery_agents':
    case 'master_phones':
    case 'phones':
    case 'site_content':
    case 'banners':
      return baseFilter;
    case 'support_tickets':
      if (!auth?.sub) return baseFilter;
      return isAdmin(auth) ? baseFilter : combineFilters(baseFilter, { user_id: auth.sub });
    case 'reviews':
      if (isAdmin(auth)) return baseFilter;
      return combineFilters(baseFilter, { is_approved: true });
    default:
      throw createHttpError(404, `Unknown table: ${table}`);
  }
};

export const getWriteScope = async (table, auth, filters) => {
  const baseFilter = buildMongoFilter(filters);

  switch (table) {
    case 'profiles':
      requireAuth(auth);
      const profileId = Types.ObjectId.isValid(auth.sub) ? new Types.ObjectId(auth.sub) : auth.sub;
      return isAdmin(auth) ? baseFilter : combineFilters(baseFilter, { _id: profileId });
    case 'products':
    case 'spare_parts':
      requireAuth(auth);
      if (!isAdmin(auth)) {
        if (!isWholesaler(auth)) throw createHttpError(403, 'Wholesaler access required.');
        return combineFilters(baseFilter, { seller_id: auth.sub });
      }
      return baseFilter;
    case 'sell_requests':
    case 'repair_bookings':
    case 'orders': {
      if (!auth?.sub) return baseFilter;
      if (isAdmin(auth)) return baseFilter;
      const userMatch = Types.ObjectId.isValid(auth.sub)
        ? { $or: [{ user_id: auth.sub }, { user_id: new Types.ObjectId(auth.sub) }] }
        : { user_id: auth.sub };
      return combineFilters(baseFilter, userMatch);
    }
    case 'sell_price_configs':
    case 'delivery_agents':
    case 'master_phones':
    case 'phones':
    case 'dispatches':
      requireAuth(auth);
      if (!isAdmin(auth)) throw createHttpError(403, 'Admin access required.');
      return baseFilter;
    case 'site_content':
    case 'banners':
      return baseFilter;
    case 'support_tickets':
      if (!auth?.sub) return baseFilter;
      return isAdmin(auth) ? baseFilter : combineFilters(baseFilter, { user_id: auth.sub });
    case 'reviews':
      if (isAdmin(auth)) return baseFilter;
      return baseFilter;
    default:
      throw createHttpError(404, `Unknown table: ${table}`);
  }
};

export const preparePayload = (table, action, input, auth) => {
  const payload = { ...input };
  delete payload.id;
  delete payload._id;

  switch (table) {
    case 'profiles':
      requireAuth(auth);
      if (!isAdmin(auth)) {
        return {
          full_name: payload.full_name ?? null,
          phone: payload.phone ?? null,
          business_name: payload.business_name ?? null,
          avatar_url: payload.avatar_url ?? null,
          updated_at: payload.updated_at ?? new Date().toISOString(),
        };
      }
      return payload;
    case 'products':
    case 'spare_parts':
      requireAuth(auth);
      if (!isAdmin(auth) && !isWholesaler(auth)) throw createHttpError(403, 'Wholesaler access required.');
      if (!isAdmin(auth)) {
        payload.seller_id = auth.sub;
        if (action === 'insert' || action === 'upsert') payload.is_approved = false;
      }
      return payload;
    case 'sell_requests':
    case 'repair_bookings':
      if (auth?.sub) {
        payload.user_id = auth.sub;
      } else if (!payload.user_id) {
        payload.user_id = `guest_${Date.now()}`;
      }
      return payload;
    case 'sell_price_configs':
      requireAuth(auth);
      if (!isAdmin(auth)) throw createHttpError(403, 'Admin access required.');
      payload.storage = payload.storage ? String(payload.storage).trim() : null;
      return payload;
    case 'delivery_agents':
    case 'master_phones':
    case 'phones':
    case 'site_content':
    case 'banners':
      return payload;
    case 'orders':
      if (action === 'insert' || action === 'upsert') {
        if (!payload.delivery_name || !payload.delivery_phone) {
          throw createHttpError(400, 'Delivery name and phone are required.');
        }
      }
      if (auth?.sub && !isAdmin(auth) && (action === 'insert' || action === 'upsert')) {
        payload.user_id = auth.sub;
      }
      return payload;
    case 'dispatches':
      requireAuth(auth);
      if (!isAdmin(auth)) throw createHttpError(403, 'Admin access required.');
      if (payload.status === 'delivered' && !payload.delivered_at) {
        payload.delivered_at = new Date().toISOString();
      }
      return payload;
    case 'reviews':
      if (auth?.sub) payload.user_id = auth.sub;
      if (!isAdmin(auth)) {
        if (action === 'insert' || action === 'upsert') payload.is_approved = false;
        else delete payload.is_approved;
      }
      return payload;
    case 'support_tickets':
      if (auth?.sub) payload.user_id = auth.sub;
      return payload;
    default:
      throw createHttpError(404, `Unknown table: ${table}`);
  }
};

export const queryTable = async (table, { auth, filters, sort, select, single, limit }) => {
  const Model = getModel(table);
  const scope = await getReadScope(table, auth, filters);
  const sortConfig = parseSort(sort);
  const selectConfig = parseSelect(select);

  let query = Model.find(scope);
  if (sortConfig) query = query.sort(sortConfig);
  if (selectConfig) query = query.select(selectConfig);
  if (typeof limit === 'number' && limit > 0) query = query.limit(limit);

  if (single) {
    const doc = await Model.findOne(scope).sort(sortConfig).select(selectConfig);
    return normalizeDoc(doc);
  }

  const docs = await query;
  return normalizeDoc(docs);
};

export const insertIntoTable = async (table, { auth, values, single }) => {
  const Model = getModel(table);
  const items = Array.isArray(values) ? values : [values];
  const preparedItems = [];

  for (const item of items) {
    const prepared = preparePayload(table, 'insert', item, auth);

    // Auto-assign delivery / pickup executive for Lucknow
    if (table === 'sell_requests' && !prepared.assigned_agent_id) {
      try {
        const assigned = await autoAssignDeliveryAgent({
          area: prepared.pickup_area,
          fullAddress: prepared.pickup_address,
          slot: prepared.pickup_slot,
          date: prepared.pickup_date,
          type: 'sell',
        });
        if (assigned?.assigned_agent_id) {
          prepared.assigned_agent_id = assigned.assigned_agent_id;
          prepared.pickup_person_name = assigned.pickup_person_name;
          prepared.pickup_person_phone = assigned.pickup_person_phone;
          prepared.estimated_arrival_time = assigned.estimated_arrival_time;
          if (prepared.status === 'pending') prepared.status = 'assigned';
        }
      } catch (e) {
        console.warn('Notice auto-assigning agent:', e);
      }
    } else if (table === 'orders' && !prepared.assigned_agent_id) {
      try {
        const assigned = await autoAssignDeliveryAgent({
          area: prepared.delivery_area,
          fullAddress: prepared.delivery_address,
          slot: prepared.delivery_slot,
          type: 'order',
        });
        if (assigned?.assigned_agent_id) {
          prepared.assigned_agent_id = assigned.assigned_agent_id;
          prepared.delivery_person_name = assigned.delivery_person_name;
          prepared.delivery_person_phone = assigned.delivery_person_phone;
          prepared.estimated_arrival_time = assigned.estimated_arrival_time;
          if (prepared.status === 'pending') prepared.status = 'assigned';
        }
      } catch (e) {
        console.warn('Notice auto-assigning agent for order:', e);
      }
    } else if (table === 'repair_bookings' && !prepared.assigned_agent_id) {
      try {
        const assigned = await autoAssignDeliveryAgent({
          area: prepared.pickup_area,
          fullAddress: prepared.pickup_address,
          slot: prepared.pickup_slot,
          date: prepared.pickup_date,
          type: 'repair',
        });
        if (assigned?.assigned_agent_id) {
          prepared.assigned_agent_id = assigned.assigned_agent_id;
          prepared.pickup_person_name = assigned.pickup_person_name;
          prepared.pickup_person_phone = assigned.pickup_person_phone;
          prepared.technician_name = assigned.pickup_person_name;
          prepared.technician_phone = assigned.pickup_person_phone;
          prepared.estimated_arrival_time = assigned.estimated_arrival_time;
          if (prepared.status === 'pending') prepared.status = 'assigned';
        }
      } catch (e) {
        console.warn('Notice auto-assigning technician:', e);
      }
    }

    preparedItems.push(prepared);
  }

  if (table === 'profiles') {
    throw createHttpError(400, 'Profiles are created through auth registration.');
  }

  const docs = await Model.insertMany(preparedItems);
  const normalized = normalizeDoc(docs);
  return single ? normalized[0] ?? null : normalized;
};

export const updateTable = async (table, { auth, filters, values, single }) => {
  const Model = getModel(table);
  const scope = await getWriteScope(table, auth, filters);
  const payload = preparePayload(table, 'update', values, auth);

  if (single) {
    const doc = await Model.findOneAndUpdate(scope, payload, { new: true, runValidators: false });
    return normalizeDoc(doc);
  }

  await Model.updateMany(scope, payload, { runValidators: false });
  const docs = await Model.find(scope);
  return normalizeDoc(docs);
};

export const upsertTable = async (table, { auth, values, single }) => {
  if (table === 'profiles') {
    requireAuth(auth);
    const payload = preparePayload(table, 'upsert', values, auth);
    const targetId = isAdmin(auth) && values?.id ? values.id : auth.sub;
    const doc = await User.findByIdAndUpdate(targetId, payload, { new: true, upsert: false, runValidators: false });
    return normalizeDoc(doc);
  }

  if (table === 'site_content' || table === 'banners') {
    const Model = getModel(table);
    const payload = preparePayload(table, 'upsert', values, auth);
    if (payload.key) {
      const doc = await Model.findOneAndUpdate({ key: payload.key }, payload, { new: true, upsert: true, runValidators: false });
      return normalizeDoc(doc);
    }
  }

  return insertIntoTable(table, { auth, values, single });
};

export const deleteFromTable = async (table, { auth, filters }) => {
  const Model = getModel(table);
  const scope = await getWriteScope(table, auth, filters);
  const result = await Model.deleteMany(scope);
  return { count: result.deletedCount };
};
