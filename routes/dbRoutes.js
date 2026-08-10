import { Router } from 'express';
import { parseJsonParam } from '../utils/dbHelpers.js';
import { createHttpError } from '../utils/error.js';
import {
  deleteFromTable,
  insertIntoTable,
  queryTable,
  updateTable,
  upsertTable,
} from '../services/dbService.js';

const router = Router();

router.get('/:table', async (req, res, next) => {
  try {
    const filters = parseJsonParam(req.query.filters, []);
    const sort = parseJsonParam(req.query.sort, null);
    const select = typeof req.query.select === 'string' ? req.query.select : '*';
    const single = req.query.single === 'true' || req.query.maybeSingle === 'true';
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

    const data = await queryTable(req.params.table, {
      auth: req.auth,
      filters,
      sort,
      select,
      single,
      limit,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/:table', async (req, res, next) => {
  try {
    const { action = 'insert', values, single = false } = req.body;
    if (!values) throw createHttpError(400, 'values is required.');

    const data = action === 'upsert'
      ? await upsertTable(req.params.table, { auth: req.auth, values, single })
      : await insertIntoTable(req.params.table, { auth: req.auth, values, single });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:table', async (req, res, next) => {
  try {
    const { filters = [], values, single = false } = req.body;
    if (!values) throw createHttpError(400, 'values is required.');

    const data = await updateTable(req.params.table, {
      auth: req.auth,
      filters,
      values,
      single,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.delete('/:table', async (req, res, next) => {
  try {
    const { filters = [] } = req.body;
    const data = await deleteFromTable(req.params.table, {
      auth: req.auth,
      filters,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
