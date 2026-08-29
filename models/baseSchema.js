import { Schema } from 'mongoose';

export const baseToJSON = {
  versionKey: false,
  transform(_doc, ret) {
    if (ret._id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
};

export const createSchema = (definition, options = {}) => new Schema(definition, {
  strict: false,
  ...options,
  toJSON: baseToJSON,
  toObject: baseToJSON,
});
