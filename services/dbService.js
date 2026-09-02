import { Types } from 'mongoose';
import { getModel, Order, User, VendorLedger, WholesaleOrder, WholesaleInventory, Product } from '../models/index.js';
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
import { triggerEventNotification } from './notificationService.js';

export const getReadScope = async (table, auth, filters) => {
  const baseFilter = buildMongoFilter(filters);

  switch (table) {
    case 'profiles':
      if (isAdmin(auth)) return baseFilter;
      if (auth?.sub) {
        const profileId = Types.ObjectId.isValid(auth.sub) ? new Types.ObjectId(auth.sub) : auth.sub;
        return combineFilters(baseFilter, { $or: [{ _id: profileId }, { id: auth.sub }] });
      }
      return baseFilter;
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
        ? {
            $or: [
              { user_id: auth.sub },
              { user_id: new Types.ObjectId(auth.sub) },
              { assigned_vendor_id: auth.sub },
            ],
          }
        : { $or: [{ user_id: auth.sub }, { assigned_vendor_id: auth.sub }] };
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
    case 'wholesale_inventories':
    case 'wholesale_inventory':
      return baseFilter;
    case 'wholesale_orders':
      if (!auth?.sub) return baseFilter;
      if (isAdmin(auth)) return baseFilter;
      return combineFilters(baseFilter, { vendor_id: auth.sub });
    case 'vendor_ledgers':
    case 'vendor_ledger':
      if (!auth?.sub) return baseFilter;
      if (isAdmin(auth)) return baseFilter;
      return combineFilters(baseFilter, { vendor_id: auth.sub });
    case 'support_tickets':
    case 'contact_messages':
    case 'contact_queries':
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
        ? {
            $or: [
              { user_id: auth.sub },
              { user_id: new Types.ObjectId(auth.sub) },
              { assigned_vendor_id: auth.sub },
            ],
          }
        : { $or: [{ user_id: auth.sub }, { assigned_vendor_id: auth.sub }] };
      return combineFilters(baseFilter, userMatch);
    }
    case 'wholesale_orders':
      requireAuth(auth);
      if (isAdmin(auth)) return baseFilter;
      return combineFilters(baseFilter, { vendor_id: auth.sub });
    case 'wholesale_inventories':
    case 'wholesale_inventory':
      requireAuth(auth);
      return baseFilter;
    case 'vendor_ledgers':
    case 'vendor_ledger':
      requireAuth(auth);
      if (!isAdmin(auth)) throw createHttpError(403, 'Admin access required.');
      return baseFilter;
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
    case 'contact_messages':
    case 'contact_queries':
      return baseFilter;
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
    case 'wholesale_inventories':
    case 'wholesale_inventory':
      return payload;
    case 'wholesale_orders':
      requireAuth(auth);
      if (!isAdmin(auth) && !payload.vendor_id) {
        payload.vendor_id = auth.sub;
      }
      return payload;
    case 'vendor_ledgers':
    case 'vendor_ledger':
      requireAuth(auth);
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
    try {
      const doc = await Model.findOne(scope).sort(sortConfig).select(selectConfig);
      return normalizeDoc(doc);
    } catch (e) {
      console.warn(`Notice querying single ${table}:`, e?.message || e);
      return null;
    }
  }

  let docs = [];
  try {
    docs = await query;
  } catch (e) {
    console.warn(`Notice querying ${table}:`, e?.message || e);
    return [];
  }
  const normalized = normalizeDoc(docs);

  // Auto-enrich customer contact info for sell_requests, repair_bookings, orders if missing
  if ((table === 'sell_requests' || table === 'repair_bookings' || table === 'orders') && normalized) {
    const list = Array.isArray(normalized) ? normalized : [normalized];
    const userIds = [...new Set(list.map((d) => d.user_id).filter((id) => id && !id.startsWith('guest_')))];
    if (userIds.length > 0) {
      try {
        const users = await User.find({ _id: { $in: userIds } }).select('_id full_name phone email');
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        for (const item of list) {
          if (item.user_id && userMap.has(item.user_id)) {
            const u = userMap.get(item.user_id);
            if (!item.customer_name) item.customer_name = u.full_name || item.delivery_name || item.pickup_person_name;
            if (!item.customer_phone) item.customer_phone = u.phone || item.delivery_phone || item.pickup_person_phone;
            if (!item.customer_email) item.customer_email = u.email;
          }
        }
      } catch (e) {
        // silent fallback
      }
    }
  }

  return normalized;
};

export const insertIntoTable = async (table, { auth, values, single }) => {
  const Model = getModel(table);
  const items = Array.isArray(values) ? values : [values];
  const preparedItems = [];

  for (const item of items) {
    const prepared = preparePayload(table, 'insert', item, auth);

    // Auto-populate customer contact details from Auth Profile
    if (auth?.sub && (table === 'sell_requests' || table === 'repair_bookings' || table === 'orders')) {
      try {
        const u = await User.findById(auth.sub);
        if (u) {
          if (!prepared.customer_name) prepared.customer_name = u.full_name || prepared.delivery_name;
          if (!prepared.customer_phone) prepared.customer_phone = u.phone || prepared.delivery_phone;
          if (!prepared.customer_email) prepared.customer_email = u.email;
        }
      } catch (err) {
        // silent fallback
      }
    }

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

  // Handle B2B Wholesale Order processing before insert
  if (table === 'wholesale_orders') {
    for (const order of preparedItems) {
      if (order.payment_method === 'credit' && order.vendor_id) {
        try {
          const vendor = await User.findById(order.vendor_id);
          if (vendor) {
            const balanceBefore = vendor.outstanding_balance || 0;
            const balanceAfter = balanceBefore + (order.total_amount || 0);
            await User.findByIdAndUpdate(vendor._id, { outstanding_balance: balanceAfter });

            // Record in VendorLedger
            await VendorLedger.create({
              vendor_id: vendor._id.toString(),
              vendor_name: vendor.business_name || vendor.full_name || order.vendor_name,
              type: 'credit_purchase',
              amount: order.total_amount,
              balance_before: balanceBefore,
              balance_after: balanceAfter,
              reference_order_id: order.id || 'B2B_PURCHASE',
              payment_mode: 'Fundu Credit (Khata)',
              notes: `Credit order placed for ${order.items?.length || 1} device(s)`,
            });
          }
        } catch (err) {
          console.warn('Notice processing wholesale credit ledger:', err);
        }
      }

      // Mark purchased inventory items as sold / decrease stock
      if (Array.isArray(order.items)) {
        for (const it of order.items) {
          if (it.inventory_id) {
            try {
              await WholesaleInventory.findByIdAndUpdate(it.inventory_id, { status: 'sold', $inc: { stock: -1 } });
            } catch (e) {
              console.warn('Notice updating wholesale inventory status:', e);
            }
          }
        }
      }
    }
  }

  // Handle Consumer Order stock reduction
  if (table === 'orders') {
    for (const order of preparedItems) {
      if (Array.isArray(order.items)) {
        for (const it of order.items) {
          const pId = it.product_id || it.id || it._id;
          const qty = Math.max(Number(it.quantity) || 1, 1);
          if (pId) {
            try {
              await Product.findOneAndUpdate(
                { $or: [{ _id: Types.ObjectId.isValid(pId) ? new Types.ObjectId(pId) : null }, { id: pId }] },
                { $inc: { stock: -qty } }
              );
            } catch (err) {
              console.warn('Notice updating product stock for order:', err);
            }
          }
        }
      }
    }
  }

  // Handle Vendor Ledger entries (e.g. Cash repayment from vendor)
  if (table === 'vendor_ledgers' || table === 'vendor_ledger') {
    for (const ledger of preparedItems) {
      if (ledger.type === 'cash_repayment' && ledger.vendor_id) {
        try {
          const vendor = await User.findById(ledger.vendor_id);
          if (vendor) {
            const balanceBefore = vendor.outstanding_balance || 0;
            const balanceAfter = Math.max(0, balanceBefore - (ledger.amount || 0));
            ledger.balance_before = balanceBefore;
            ledger.balance_after = balanceAfter;
            await User.findByIdAndUpdate(vendor._id, { outstanding_balance: balanceAfter });
          }
        } catch (err) {
          console.warn('Notice updating vendor balance on cash repayment:', err);
        }
      } else if (ledger.type === 'credit_limit_set' && ledger.vendor_id) {
        try {
          await User.findByIdAndUpdate(ledger.vendor_id, { credit_limit: ledger.amount, is_b2b_approved: true });
        } catch (err) {
          console.warn('Notice updating vendor credit limit:', err);
        }
      }
    }
  }

  const docs = await Model.insertMany(preparedItems);
  const normalized = normalizeDoc(docs);

  // Background Automated Notification Triggers
  try {
    const docList = Array.isArray(normalized) ? normalized : [normalized];
    for (const doc of docList) {
      if (table === 'orders') {
        triggerEventNotification('order_created', doc);
      } else if (table === 'sell_requests') {
        triggerEventNotification('sell_request_created', doc);
      } else if (table === 'repair_bookings') {
        triggerEventNotification('repair_created', doc);
      } else if (table === 'wholesale_orders') {
        triggerEventNotification('wholesale_order_created', doc);
      } else if (table === 'vendor_ledgers' || table === 'vendor_ledger') {
        triggerEventNotification('vendor_ledger_updated', doc);
      }
    }
  } catch (notifErr) {
    console.warn('Notification trigger notice:', notifErr);
  }

  return single ? normalized[0] ?? null : normalized;
};

export const updateTable = async (table, { auth, filters, values, single }) => {
  const Model = getModel(table);
  const scope = await getWriteScope(table, auth, filters);
  const payload = preparePayload(table, 'update', values, auth);

  let updatedDoc = null;
  if (single) {
    const doc = await Model.findOneAndUpdate(scope, payload, { new: true, runValidators: false });
    updatedDoc = normalizeDoc(doc);
  } else {
    await Model.updateMany(scope, payload, { runValidators: false });
    const docs = await Model.find(scope);
    updatedDoc = normalizeDoc(docs);
  }

  // Background Status Change & Vendor Commission / Credit Ledger Updates
  try {
    const docList = Array.isArray(updatedDoc) ? updatedDoc : [updatedDoc];
    for (const doc of docList) {
      if (doc) {
        if (table === 'orders') {
          if (doc.status === 'dispatched') triggerEventNotification('order_dispatched', doc);
          else if (doc.status === 'delivered') triggerEventNotification('order_delivered', doc);
          else if (doc.status === 'cancelled') {
            // Restore inventory stock for cancelled order items
            if (Array.isArray(doc.items)) {
              for (const it of doc.items) {
                const pId = it.product_id || it.id || it._id;
                const qty = Math.max(Number(it.quantity) || 1, 1);
                if (pId) {
                  try {
                    await Product.findOneAndUpdate(
                      { $or: [{ _id: Types.ObjectId.isValid(pId) ? new Types.ObjectId(pId) : null }, { id: pId }] },
                      { $inc: { stock: qty } }
                    );
                  } catch (err) {
                    console.warn('Notice restoring stock for cancelled order:', err);
                  }
                }
              }
            }
          }
        } else if (table === 'sell_requests') {
          if (doc.status === 'completed' || doc.status === 'picked_up') triggerEventNotification('sell_request_completed', doc);
          
          // Vendor Mobile Buyback & 10% Commission Ledger Logic
          if ((doc.vendor_quote_status === 'user_accepted' || doc.status === 'completed') && doc.assigned_vendor_id && doc.vendor_quote_price) {
            const vendor = await User.findById(doc.assigned_vendor_id);
            if (vendor) {
              const buybackPrice = Number(doc.vendor_quote_price) || 0;
              const commissionAmount = Math.round(buybackPrice * 0.10);
              const totalDebited = buybackPrice;

              const balanceBefore = vendor.outstanding_balance || 0;
              const balanceAfter = balanceBefore + totalDebited;

              await User.findByIdAndUpdate(vendor._id, { outstanding_balance: balanceAfter });

              // Record Vendor Ledgers (Buyback payout + 10% commission record)
              await VendorLedger.create({
                vendor_id: vendor._id.toString(),
                vendor_name: vendor.business_name || vendor.full_name,
                type: 'sell_buyback_payout',
                amount: buybackPrice,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                reference_order_id: doc.id || doc._id?.toString(),
                payment_mode: 'Website Limit Credit',
                notes: `Purchased user phone (${doc.brand} ${doc.model}) via website credit limit.`,
              });

              await VendorLedger.create({
                vendor_id: vendor._id.toString(),
                vendor_name: vendor.business_name || vendor.full_name,
                type: 'sell_commission_fee',
                amount: commissionAmount,
                balance_before: balanceAfter,
                balance_after: balanceAfter,
                reference_order_id: doc.id || doc._id?.toString(),
                payment_mode: '10% Platform Commission',
                notes: `10% Platform commission fee on mobile buyback ₹${buybackPrice}.`,
              });
            }
          }
        } else if (table === 'repair_bookings') {
          // Vendor Repair Quotation & 10% Commission Ledger Logic
          if ((doc.quotation_status === 'user_accepted' || doc.quotation_status === 'paid' || doc.status === 'paid') && doc.assigned_vendor_id && doc.vendor_quotation_amount) {
            const vendor = await User.findById(doc.assigned_vendor_id);
            if (vendor) {
              const totalRepairCost = Number(doc.vendor_quotation_amount) || 0;
              const commissionAmount = Math.round(totalRepairCost * 0.10);
              const vendorEarning = totalRepairCost - commissionAmount;

              await VendorLedger.create({
                vendor_id: vendor._id.toString(),
                vendor_name: vendor.business_name || vendor.full_name,
                type: 'repair_earning',
                amount: vendorEarning,
                balance_before: vendor.outstanding_balance || 0,
                balance_after: vendor.outstanding_balance || 0,
                reference_order_id: doc.id || doc._id?.toString(),
                payment_mode: 'User Website Payment',
                notes: `Earned 90% (₹${vendorEarning}) for repairing ${doc.brand} ${doc.model} (${doc.problem}).`,
              });

              await VendorLedger.create({
                vendor_id: vendor._id.toString(),
                vendor_name: vendor.business_name || vendor.full_name,
                type: 'repair_commission_fee',
                amount: commissionAmount,
                balance_before: vendor.outstanding_balance || 0,
                balance_after: vendor.outstanding_balance || 0,
                reference_order_id: doc.id || doc._id?.toString(),
                payment_mode: '10% Platform Commission',
                notes: `10% Platform commission fee on repair job ₹${totalRepairCost}.`,
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Notice on status change notification:', e);
  }

  return updatedDoc;
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
