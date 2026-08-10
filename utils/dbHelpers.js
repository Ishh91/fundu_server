import { Types } from 'mongoose';
import { createHttpError } from './error.js';

export const normalizeDoc = (doc) => {
  if (!doc) return null;
  if (Array.isArray(doc)) return doc.map(normalizeDoc);
  if (typeof doc.toJSON === 'function') return doc.toJSON();
  const plain = { ...doc };
  if (plain._id) {
    plain.id = plain._id.toString();
    delete plain._id;
  }
  delete plain.__v;
  delete plain.passwordHash;
  return plain;
};

export const mapField = (field) => (field === 'id' ? '_id' : field);

export const convertFilterValue = (field, value) => {
  if (field === '_id' && typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  if (field === '_id' && Array.isArray(value)) {
    return value.map((item) => (
      typeof item === 'string' && Types.ObjectId.isValid(item) ? new Types.ObjectId(item) : item
    ));
  }
  return value;
};

export const buildMongoFilter = (filters = []) => {
  const conditions = filters.map(({ field, op, value }) => {
    const dbField = mapField(field);
    const dbValue = convertFilterValue(dbField, value);
    if (op === 'eq') return { [dbField]: dbValue };
    if (op === 'in') return { [dbField]: { $in: Array.isArray(dbValue) ? dbValue : [dbValue] } };
    throw createHttpError(400, `Unsupported filter operator: ${op}`);
  });

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

export const combineFilters = (...filters) => {
  const valid = filters.filter((item) => item && Object.keys(item).length > 0);
  if (valid.length === 0) return {};
  if (valid.length === 1) return valid[0];
  return { $and: valid };
};

export const parseSort = (sort) => {
  if (!sort?.field) return undefined;
  return { [mapField(sort.field)]: sort.ascending === false ? -1 : 1 };
};

export const parseSelect = (select) => {
  if (!select || select === '*') return undefined;
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part === 'id' ? '_id' : part))
    .join(' ');
};

export const parseJsonParam = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return fallback;
  return JSON.parse(value);
};
