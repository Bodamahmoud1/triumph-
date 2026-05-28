const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const capturedRoutes = { get: [], patch: [] };
const originalLoad = Module._load;
Module._load = function mockRouteDependencies(request, parent, isMain) {
  if (request === 'express') {
    return {
      Router: () => ({
        get(path, ...handlers) { capturedRoutes.get.push({ path, handlers }); },
        patch(path, ...handlers) { capturedRoutes.patch.push({ path, handlers }); }
      })
    };
  }
  if (request === '../middleware/auth') {
    return (req, res, next) => {
      req.user = { id: 1 };
      next();
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { validateContentUpdates } = require('../server/routes/content');
Module._load = originalLoad;

function createMockDb() {
  const stored = [];
  return {
    stored,
    transaction(callback) {
      return () => callback();
    },
    prepare(sql) {
      if (sql.includes('INSERT INTO content')) {
        return { run: (section, key, value) => stored.push({ section, key, value }) };
      }
      if (sql.includes('INSERT INTO audit_log')) {
        return { run() {} };
      }
      return { all: () => [] };
    }
  };
}

function runPatch(section, body) {
  const route = capturedRoutes.patch.find((item) => item.path === '/:section');
  assert.ok(route, 'PATCH /:section route should be registered');

  const req = { params: { section }, body, app: { locals: { db: createMockDb() } }, user: { id: 1 } };
  const res = {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };

  let index = 0;
  const next = () => {
    const handler = route.handlers[index++];
    if (handler) handler(req, res, next);
  };
  next();
  return res;
}

test('content validation accepts valid intro updates', () => {
  const result = validateContentUpdates('intro', {
    title_ar: 'Laundry Guide / دليل المغسلة',
    body_ar: 'Chemicals & Washing Programs Reference',
    title_en: 'Laundry Guide',
    body_en: 'Chemicals reference'
  });

  assert.deepEqual(result, {
    value: {
      title_ar: 'Laundry Guide / دليل المغسلة',
      body_ar: 'Chemicals & Washing Programs Reference',
      title_en: 'Laundry Guide',
      body_en: 'Chemicals reference'
    }
  });
});

test('content validation accepts and serializes explicitly JSON fields', () => {
  const cards = [{ icon: '💡', title_ar: 'نصيحة', content_ar: 'محتوى' }];
  const result = validateContentUpdates('tips', { cards_json: cards });

  assert.equal(result.error, undefined);
  assert.equal(result.value.cards_json, JSON.stringify(cards));
});

test('content validation rejects unknown sections', () => {
  const result = validateContentUpdates('unknown', { title_ar: 'Title' });

  assert.match(result.error, /Unknown content section/);
});

test('content validation rejects unknown keys', () => {
  const result = validateContentUpdates('intro', {
    title_ar: 'Title',
    body_ar: 'Body',
    unexpected: 'Nope'
  });

  assert.match(result.error, /Unknown content field/);
});

test('content validation rejects oversized values', () => {
  const result = validateContentUpdates('intro', {
    title_ar: 'a'.repeat(201),
    body_ar: 'Body'
  });

  assert.match(result.error, /title_ar must be 200 characters or fewer/);
});

test('content validation rejects non-object request bodies', () => {
  assert.match(validateContentUpdates('intro', null).error, /Request body must be a JSON object/);
  assert.match(validateContentUpdates('intro', ['title']).error, /Request body must be a JSON object/);
});

test('content validation rejects structured values for string fields', () => {
  const result = validateContentUpdates('intro', {
    title_ar: { text: 'Title' },
    body_ar: 'Body'
  });

  assert.match(result.error, /title_ar must be a string/);
});


test('content PATCH route returns 400 for unknown sections', () => {
  const res = runPatch('unknown', { title_ar: 'Title' });

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /Unknown content section/);
});

test('content PATCH route returns 400 for unknown keys', () => {
  const res = runPatch('intro', {
    title_ar: 'Title',
    body_ar: 'Body',
    unexpected: 'Nope'
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /Unknown content field/);
});

test('content PATCH route returns 400 for oversized values', () => {
  const res = runPatch('intro', {
    title_ar: 'a'.repeat(201),
    body_ar: 'Body'
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /title_ar must be 200 characters or fewer/);
});

test('content PATCH route returns 400 for non-object request bodies', () => {
  const res = runPatch('intro', null);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /Request body must be a JSON object/);
});
