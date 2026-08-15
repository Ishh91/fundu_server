import { Types } from 'mongoose';
import { createHttpError } from './error.js';

export const normalizeDoc = (doc) => {
  if (!doc) return null;
  if (Array.isArray(doc)) return doc.map(normalizeDoc);
  if (typeof doc.toObject === 'function') {
    const obj = doc.toObject();
    if (obj._id) {
      obj.id = obj._id.toString();
      delete obj._id;
    }
    delete obj.__v;
    delete obj.passwordHash;
    return obj;
  }
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
    try {
      return new Types.ObjectId(value);
    } catch {
      return value;
    }
  }
  if (field === '_id' && Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string' && Types.ObjectId.isValid(item)) {
        try {
          return new Types.ObjectId(item);
        } catch {
          return item;
        }
      }
      return item;
    });
  }
  return value;
};

export const buildMongoFilter = (filters = []) => {
  if (!Array.isArray(filters)) return {};
  const conditions = filters
    .filter((f) => f && f.field)
    .map(({ field, op = 'eq', value }) => {
      const dbField = mapField(field);
      const dbValue = convertFilterValue(dbField, value);
      if (op === 'eq') return { [dbField]: dbValue };
      if (op === 'in') return { [dbField]: { $in: Array.isArray(dbValue) ? dbValue : [dbValue] } };
      return { [dbField]: dbValue };
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
  if (!sort) return undefined;
  if (typeof sort === 'string') {
    return { [mapField(sort)]: 1 };
  }
  if (typeof sort === 'object' && sort.field) {
    return { [mapField(sort.field)]: sort.ascending === false ? -1 : 1 };
  }
  return undefined;
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
  if (typeof value !== 'string') return typeof value === 'object' ? value : fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
