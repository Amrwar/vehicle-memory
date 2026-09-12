/**
 * The API described as a document. NFR-705, Phase 21.
 *
 * One registry, kept beside the handlers, from which both the served
 * document (`/api/v1/openapi.json`) and the committed copy
 * (`docs/02-design/openapi.json`) are produced. The network probe asserts
 * that every route file under `api/v1` has an entry here, so a handler
 * cannot exist without appearing in the contract, and `npm run docs:openapi`
 * fails when the committed copy is behind.
 */

export const API_VERSION = '1.0.0';

const money = {
  type: 'string',
  description: 'A decimal amount as a string, never a float',
  example: '1509.00',
};
const date = { type: 'string', format: 'date-time' };

const refusal = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      enum: ['MISSING', 'UNKNOWN', 'REVOKED', 'RATE_LIMITED', 'NOT_FOUND', 'FAILED'],
    },
    message: { type: 'string' },
  },
  required: ['error', 'message'],
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Carnet API',
    version: API_VERSION,
    description:
      "Read-only access to an organisation's own records and to the vehicles it is entitled to read. Every collection is bounded by a window and a row cap. There are no write endpoints yet, by design.",
  },
  servers: [{ url: 'https://carnetpassport.com/api/v1' }],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'http',
        scheme: 'bearer',
        description:
          'An organisation key minted on the Settings page, starting with `cn_`. Shown once; only its digest is stored. A thousand calls an hour per key; a refusal for rate carries Retry-After.',
      },
    },
    schemas: {
      Refusal: refusal,
      Job: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          number: { type: 'integer' },
          status: { type: 'string' },
          description: { type: 'string' },
          createdAt: date,
          updatedAt: date,
          completedAt: { ...date, nullable: true },
          invoicedAt: { ...date, nullable: true },
          odometerKm: { type: 'integer', nullable: true },
          customer: {
            type: 'object',
            properties: { id: { type: 'string' }, displayName: { type: 'string' } },
          },
          vehicle: {
            type: 'object',
            properties: {
              vin: { type: 'string' },
              registration: { type: 'string', nullable: true },
              make: { type: 'string', nullable: true },
              model: { type: 'string', nullable: true },
            },
          },
          invoices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                number: { type: 'string' },
                total: { type: 'number' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          number: { type: 'string' },
          status: { type: 'string' },
          currency: { type: 'string' },
          subtotal: money,
          taxTotal: money,
          total: money,
          amountPaid: money,
          issuedAt: { ...date, nullable: true },
          dueAt: { ...date, nullable: true },
          updatedAt: date,
          customer: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              displayName: { type: 'string' },
              email: { type: 'string', nullable: true },
            },
          },
          job: {
            type: 'object',
            nullable: true,
            properties: { number: { type: 'integer' }, vehicle: { type: 'object' } },
          },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string' },
                description: { type: 'string' },
                quantity: money,
                unitPrice: money,
                tax: money,
                total: money,
              },
            },
          },
          payments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                amount: money,
                method: { type: 'string' },
                reference: { type: 'string', nullable: true },
                receivedAt: date,
              },
            },
          },
        },
      },
      Passport: {
        type: 'object',
        properties: {
          vehicle: {
            type: 'object',
            properties: {
              vin: { type: 'string' },
              registration: { type: 'string', nullable: true },
              make: { type: 'string', nullable: true },
              model: { type: 'string', nullable: true },
              year: { type: 'integer', nullable: true },
              lastOdometerKm: { type: 'integer', nullable: true },
              lastOdometerAt: { ...date, nullable: true },
              entries: { type: 'integer' },
              chainHead: {
                type: 'string',
                nullable: true,
                description: 'The hash of the most recent entry',
              },
            },
          },
          history: {
            type: 'object',
            properties: {
              recordedHere: { type: 'integer' },
              recordedElsewhere: { type: 'integer' },
              otherWorkshops: { type: 'array', items: { type: 'string' } },
              statement: { type: 'string' },
            },
          },
          documents: {
            type: 'array',
            description: 'The paperwork, with links that expire in an hour',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                kind: { type: 'string' },
                title: { type: 'string' },
                reference: { type: 'string', nullable: true },
                issuedAt: { ...date, nullable: true },
                expiresAt: { ...date, nullable: true },
                expiry: { type: 'string', enum: ['NONE', 'OK', 'SOON', 'EXPIRED'] },
                mimeType: { type: 'string' },
                addedBy: { type: 'string' },
                url: { type: 'string', nullable: true },
              },
            },
          },
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                title: { type: 'string' },
                summary: { type: 'string', nullable: true },
                occurredAt: date,
                odometerKm: { type: 'integer', nullable: true },
                verification: { type: 'string' },
                recordedBy: { type: 'string', nullable: true },
                recordedHere: { type: 'boolean' },
                detail: {
                  type: 'object',
                  nullable: true,
                  description:
                    "Another workshop's entries have jobId, jobNumber, performedBy and inspectionId withheld",
                },
              },
            },
          },
        },
      },
    },
    responses: {
      Unauthorised: { description: 'No key', content: { 'application/json': { schema: refusal } } },
      Forbidden: {
        description: 'Unknown or revoked key',
        content: { 'application/json': { schema: refusal } },
      },
      RateLimited: {
        description: 'The key has made its thousand calls this hour',
        headers: {
          'Retry-After': {
            schema: { type: 'integer' },
            description: 'Seconds until the window resets',
          },
        },
        content: { 'application/json': { schema: refusal } },
      },
    },
  },
  paths: {
    '/jobs': {
      get: {
        summary: "The organisation's jobs, newest first",
        parameters: [
          {
            name: 'since',
            in: 'query',
            schema: { type: 'string', format: 'date' },
            description:
              'Updated since this date. Defaults to thirty days back; capped at a year back.',
          },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'At most two hundred jobs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    since: date,
                    count: { type: 'integer' },
                    jobs: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/invoices': {
      get: {
        summary: "The organisation's invoices with lines and payments",
        parameters: [{ name: 'since', in: 'query', schema: { type: 'string', format: 'date' } }],
        responses: {
          '200': {
            description: 'At most two hundred invoices, amounts as strings',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    since: date,
                    count: { type: 'integer' },
                    invoices: { type: 'array', items: { $ref: '#/components/schemas/Invoice' } },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/vehicles/{vin}': {
      get: {
        summary: "A vehicle's passport as the organisation is entitled to read it",
        parameters: [
          {
            name: 'vin',
            in: 'path',
            required: true,
            schema: { type: 'string', minLength: 17, maxLength: 17 },
          },
        ],
        responses: {
          '200': {
            description: 'The vehicle, its history summary, its paperwork and its events',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Passport' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': {
            description:
              'No such vehicle on your books. Not distinguished from a vehicle that does not exist.',
            content: { 'application/json': { schema: refusal } },
          },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'This document',
        security: [],
        responses: {
          '200': {
            description: 'The OpenAPI document',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  },
} as const;

/** The route files under `api/v1` that a path in the document corresponds to. */
export function routeFileFor(path: string): string {
  return path.replace(/\{(\w+)\}/g, '[$1]').replace(/^\//, '') + '/route.ts';
}
