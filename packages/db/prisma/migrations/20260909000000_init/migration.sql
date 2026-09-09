-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgPlan" AS ENUM ('CORE', 'COMPLETE', 'GROUP');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'BOOKKEEPER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'PLUGIN_HYBRID', 'ELECTRIC', 'LPG', 'HYDROGEN', 'OTHER');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC', 'CVT', 'DCT', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleEventType" AS ENUM ('OWNERSHIP_TRANSFER', 'REGISTRATION_CHANGE', 'MILEAGE_READING', 'SERVICE', 'REPAIR', 'PART_FITTED', 'INSPECTION', 'TIRE', 'ACCIDENT', 'RECALL_NOTICE', 'RECALL_PERFORMED', 'MODIFICATION', 'MAINTENANCE', 'IMPORT', 'WRITE_OFF', 'NOTE');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('SELF_REPORTED', 'WORKSHOP_RECORDED', 'WORKSHOP_VERIFIED', 'AUTHORITY');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('PHOTO', 'DOCUMENT', 'REPORT', 'VIDEO');

-- CreateEnum
CREATE TYPE "OwnerKind" AS ENUM ('PRIVATE', 'COMPANY', 'FLEET', 'DEALER', 'FINANCE');

-- CreateEnum
CREATE TYPE "OdometerSource" AS ENUM ('WORKSHOP', 'OWNER', 'INSPECTION', 'AUTHORITY', 'TELEMATICS');

-- CreateEnum
CREATE TYPE "OdometerAnomaly" AS ENUM ('NONE', 'DECREASE', 'IMPLAUSIBLE_RATE');

-- CreateEnum
CREATE TYPE "AccessScope" AS ENUM ('READ', 'WRITE', 'OWNER');

-- CreateEnum
CREATE TYPE "GrantReason" AS ENUM ('OWNED', 'SERVICED', 'OWNER_GRANTED', 'PROSPECTIVE_BUYER', 'AUTHORITY');

-- CreateEnum
CREATE TYPE "RecallSeverity" AS ENUM ('STANDARD', 'SAFETY', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecallStatus" AS ENUM ('OPEN', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'CONVERTED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PHONE', 'WALK_IN', 'PORTAL', 'ONLINE', 'RECALL', 'REMINDER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'BOOKED', 'RECEIVED', 'INSPECTING', 'DIAGNOSED', 'ESTIMATED', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'COMPLETED', 'INVOICED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartLineStatus" AS ENUM ('REQUESTED', 'RESERVED', 'ON_ORDER', 'FITTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('NONE', 'TREAD_DEPTH_MM', 'PAD_THICKNESS_MM', 'DISC_THICKNESS_MM', 'PERCENT', 'VOLTAGE', 'PRESSURE_BAR', 'TEMPERATURE_C', 'MM');

-- CreateEnum
CREATE TYPE "WheelPosition" AS ENUM ('FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', 'SPARE');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('PASS', 'ADVISORY', 'CRITICAL', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_APPROVED', 'DECLINED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "LineKind" AS ENUM ('LABOUR', 'PART', 'FEE', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "LineDecision" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SequenceKind" AS ENUM ('JOB', 'ESTIMATE', 'INVOICE', 'CREDIT_NOTE', 'PURCHASE_ORDER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PART_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'CHEQUE', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS', 'PORTAL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'STOCKTAKE');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ORDERED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PART_RECEIVED', 'RECEIVED', 'BILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('AWAITING', 'APPROVED', 'PART_PAID', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "plan" "OrgPlan" NOT NULL DEFAULT 'CORE',
    "logoUrl" TEXT,
    "reapprovalThresholdPct" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "locality" TEXT,
    "region" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GB',
    "phone" TEXT,
    "timezone" TEXT,
    "dailyCapacityHours" DECIMAL(6,2) NOT NULL DEFAULT 40.0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bays" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capability" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "locationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "costRate" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "succeeded" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "vinValid" BOOLEAN NOT NULL DEFAULT true,
    "registration" TEXT,
    "registrationRegion" TEXT,
    "registrationExpiresAt" TIMESTAMP(3),
    "make" TEXT,
    "model" TEXT,
    "variant" TEXT,
    "year" INTEGER,
    "engineCode" TEXT,
    "engineCapacityCc" INTEGER,
    "fuelType" "FuelType",
    "transmission" "Transmission",
    "bodyType" TEXT,
    "driveType" TEXT,
    "colour" TEXT,
    "seats" INTEGER,
    "firstRegisteredAt" TIMESTAMP(3),
    "chainHead" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "lastOdometerKm" INTEGER,
    "lastOdometerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_events" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "VehicleEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification" "VerificationLevel" NOT NULL DEFAULT 'WORKSHOP_RECORDED',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "payload" JSONB NOT NULL,
    "odometerKm" INTEGER,
    "recordedByOrgId" TEXT,
    "recordedByUserId" TEXT,
    "jobRef" TEXT,
    "hash" TEXT NOT NULL,
    "prevHash" TEXT,
    "supersedesId" TEXT,
    "supersededById" TEXT,

    CONSTRAINT "vehicle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_event_attachments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'PHOTO',
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_event_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_ownerships" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerName" TEXT,
    "ownerKind" "OwnerKind" NOT NULL DEFAULT 'PRIVATE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odometer_readings" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "km" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "source" "OdometerSource" NOT NULL DEFAULT 'WORKSHOP',
    "anomaly" "OdometerAnomaly" NOT NULL DEFAULT 'NONE',
    "jobRef" TEXT,
    "recordedByOrgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odometer_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_access_grants" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT,
    "scope" "AccessScope" NOT NULL DEFAULT 'READ',
    "reason" "GrantReason" NOT NULL DEFAULT 'SERVICED',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "visibleFrom" TIMESTAMP(3),
    "visibleTo" TIMESTAMP(3),

    CONSTRAINT "vehicle_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_shares" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passport_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_share_accesses" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passport_share_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalls" (
    "id" TEXT NOT NULL,
    "campaignRef" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "RecallSeverity" NOT NULL DEFAULT 'STANDARD',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_recalls" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "recallId" TEXT NOT NULL,
    "status" "RecallStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedByOrgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "CustomerKind" NOT NULL DEFAULT 'INDIVIDUAL',
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "taxNumber" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "locality" TEXT,
    "region" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GB',
    "sourceOfBusiness" TEXT,
    "notes" TEXT,
    "marketingEmailConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingSmsConsent" BOOLEAN NOT NULL DEFAULT false,
    "portalUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_types" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '#2a41d8',
    "requiresQualityCheck" BOOLEAN NOT NULL DEFAULT false,
    "defaultHours" DECIMAL(6,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "job_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '#6b7488',

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_items" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "defaultHours" DECIMAL(6,2) NOT NULL DEFAULT 1.0,
    "defaultPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "bayId" TEXT,
    "technicianId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "estimatedHours" DECIMAL(6,2) NOT NULL DEFAULT 1.0,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "source" "BookingSource" NOT NULL DEFAULT 'PHONE',
    "jobId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "bayId" TEXT,
    "billToCustomerId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "shortDescription" TEXT NOT NULL,
    "details" TEXT,
    "diagnosis" TEXT,
    "customerOrderNumber" TEXT,
    "sourceOfBusiness" TEXT,
    "odometerInKm" INTEGER,
    "odometerOutKm" INTEGER,
    "estimatedHours" DECIMAL(6,2),
    "receivedAt" TIMESTAMP(3),
    "promisedAt" TIMESTAMP(3),
    "pickUpAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "courtesyVehicleNote" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_technicians" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "job_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_job_types" (
    "jobId" TEXT NOT NULL,
    "jobTypeId" TEXT NOT NULL,

    CONSTRAINT "job_job_types_pkey" PRIMARY KEY ("jobId","jobTypeId")
);

-- CreateTable
CREATE TABLE "job_tags" (
    "jobId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "job_tags_pkey" PRIMARY KEY ("jobId","tagId")
);

-- CreateTable
CREATE TABLE "job_status_events" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_tasks" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneByUserId" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_labour_lines" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_labour_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_part_lines" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "productId" TEXT,
    "partNumber" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "status" "PartLineStatus" NOT NULL DEFAULT 'REQUESTED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_part_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_fee_lines" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxRateId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_fee_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_notes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "isCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_attachments" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'PHOTO',
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "isCustomerVisible" BOOLEAN NOT NULL DEFAULT true,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "minutes" INTEGER,
    "costRate" DECIMAL(10,2),
    "note" TEXT,
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "checkedByUserId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_follow_ups" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "assignedToUserId" TEXT,
    "note" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inspection_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_template_items" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guidance" TEXT,
    "measurementType" "MeasurementType" NOT NULL DEFAULT 'NONE',
    "position" "WheelPosition",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inspection_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "performedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "advisoryCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_results" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "sectionName" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'NOT_CHECKED',
    "note" TEXT,
    "measurementValue" DECIMAL(10,2),
    "measurementType" "MeasurementType" NOT NULL DEFAULT 'NONE',
    "position" "WheelPosition",
    "recommendedAction" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_photos" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL DEFAULT 'LABOUR',
    "description" TEXT NOT NULL,
    "detail" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "decision" "LineDecision" NOT NULL DEFAULT 'PENDING',
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "inspectionResultId" TEXT,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_shares" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "sentTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_approvals" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "decision" "LineDecision" NOT NULL,
    "approvedTotal" DECIMAL(12,2) NOT NULL,
    "declinedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedByName" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "SequenceKind" NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "jobId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL DEFAULT 'LABOUR',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "providerRef" TEXT,
    "error" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_schedules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalMonths" INTEGER,
    "intervalKm" INTEGER,
    "lastPerformedAt" TIMESTAMP(3),
    "lastPerformedKm" INTEGER,
    "dueAt" TIMESTAMP(3),
    "dueKm" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "costPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "sellPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorderQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "barcode" TEXT,
    "isStocked" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "onHand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "binLocation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "balanceAfter" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "jobPartLineId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountRef" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "locality" TEXT,
    "postcode" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT,
    "requestedByUserId" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requestId" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedAt" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "received" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bills" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderId" TEXT,
    "reference" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'AWAITING',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodId" TEXT,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "memo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_isActive_idx" ON "organizations"("isActive");

-- CreateIndex
CREATE INDEX "locations_orgId_isActive_idx" ON "locations"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "locations_orgId_code_key" ON "locations"("orgId", "code");

-- CreateIndex
CREATE INDEX "bays_locationId_isActive_idx" ON "bays"("locationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "bays_locationId_code_key" ON "bays"("locationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "memberships_orgId_role_isActive_idx" ON "memberships"("orgId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_orgId_key" ON "memberships"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_createdAt_idx" ON "login_attempts"("email", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_ip_createdAt_idx" ON "login_attempts"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_createdAt_idx" ON "audit_logs"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "outbox_events_processedAt_availableAt_idx" ON "outbox_events"("processedAt", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");

-- CreateIndex
CREATE INDEX "vehicles_registration_idx" ON "vehicles"("registration");

-- CreateIndex
CREATE INDEX "vehicles_make_model_year_idx" ON "vehicles"("make", "model", "year");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_events_supersedesId_key" ON "vehicle_events"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_events_supersededById_key" ON "vehicle_events"("supersededById");

-- CreateIndex
CREATE INDEX "vehicle_events_vehicleId_occurredAt_idx" ON "vehicle_events"("vehicleId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "vehicle_events_vehicleId_type_idx" ON "vehicle_events"("vehicleId", "type");

-- CreateIndex
CREATE INDEX "vehicle_events_recordedByOrgId_idx" ON "vehicle_events"("recordedByOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_events_vehicleId_sequence_key" ON "vehicle_events"("vehicleId", "sequence");

-- CreateIndex
CREATE INDEX "vehicle_event_attachments_eventId_idx" ON "vehicle_event_attachments"("eventId");

-- CreateIndex
CREATE INDEX "vehicle_ownerships_vehicleId_startedAt_idx" ON "vehicle_ownerships"("vehicleId", "startedAt");

-- CreateIndex
CREATE INDEX "vehicle_ownerships_ownerUserId_idx" ON "vehicle_ownerships"("ownerUserId");

-- CreateIndex
CREATE INDEX "odometer_readings_vehicleId_readAt_idx" ON "odometer_readings"("vehicleId", "readAt" DESC);

-- CreateIndex
CREATE INDEX "odometer_readings_anomaly_idx" ON "odometer_readings"("anomaly");

-- CreateIndex
CREATE INDEX "vehicle_access_grants_vehicleId_userId_idx" ON "vehicle_access_grants"("vehicleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_access_grants_vehicleId_orgId_key" ON "vehicle_access_grants"("vehicleId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "passport_shares_tokenHash_key" ON "passport_shares"("tokenHash");

-- CreateIndex
CREATE INDEX "passport_shares_vehicleId_idx" ON "passport_shares"("vehicleId");

-- CreateIndex
CREATE INDEX "passport_share_accesses_shareId_createdAt_idx" ON "passport_share_accesses"("shareId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "recalls_campaignRef_key" ON "recalls"("campaignRef");

-- CreateIndex
CREATE INDEX "recalls_manufacturer_idx" ON "recalls"("manufacturer");

-- CreateIndex
CREATE INDEX "vehicle_recalls_status_idx" ON "vehicle_recalls"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_recalls_vehicleId_recallId_key" ON "vehicle_recalls"("vehicleId", "recallId");

-- CreateIndex
CREATE INDEX "customers_orgId_isActive_idx" ON "customers"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "customers_orgId_mobile_idx" ON "customers"("orgId", "mobile");

-- CreateIndex
CREATE INDEX "customers_orgId_email_idx" ON "customers"("orgId", "email");

-- CreateIndex
CREATE INDEX "customers_orgId_displayName_idx" ON "customers"("orgId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "job_types_orgId_name_key" ON "job_types"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_orgId_name_key" ON "tags"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "service_items_orgId_code_key" ON "service_items"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_jobId_key" ON "bookings"("jobId");

-- CreateIndex
CREATE INDEX "bookings_orgId_startAt_idx" ON "bookings"("orgId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_locationId_startAt_idx" ON "bookings"("locationId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_bayId_startAt_idx" ON "bookings"("bayId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_technicianId_startAt_idx" ON "bookings"("technicianId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "jobs_orgId_status_idx" ON "jobs"("orgId", "status");

-- CreateIndex
CREATE INDEX "jobs_orgId_createdAt_idx" ON "jobs"("orgId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "jobs_vehicleId_idx" ON "jobs"("vehicleId");

-- CreateIndex
CREATE INDEX "jobs_customerId_idx" ON "jobs"("customerId");

-- CreateIndex
CREATE INDEX "jobs_locationId_status_idx" ON "jobs"("locationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_orgId_number_key" ON "jobs"("orgId", "number");

-- CreateIndex
CREATE INDEX "job_technicians_userId_idx" ON "job_technicians"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "job_technicians_jobId_userId_key" ON "job_technicians"("jobId", "userId");

-- CreateIndex
CREATE INDEX "job_status_events_jobId_createdAt_idx" ON "job_status_events"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "job_tasks_jobId_sortOrder_idx" ON "job_tasks"("jobId", "sortOrder");

-- CreateIndex
CREATE INDEX "job_labour_lines_jobId_idx" ON "job_labour_lines"("jobId");

-- CreateIndex
CREATE INDEX "job_part_lines_jobId_idx" ON "job_part_lines"("jobId");

-- CreateIndex
CREATE INDEX "job_fee_lines_jobId_idx" ON "job_fee_lines"("jobId");

-- CreateIndex
CREATE INDEX "job_notes_jobId_createdAt_idx" ON "job_notes"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "job_attachments_jobId_idx" ON "job_attachments"("jobId");

-- CreateIndex
CREATE INDEX "time_entries_jobId_idx" ON "time_entries"("jobId");

-- CreateIndex
CREATE INDEX "time_entries_userId_startedAt_idx" ON "time_entries"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "quality_checks_jobId_idx" ON "quality_checks"("jobId");

-- CreateIndex
CREATE INDEX "job_follow_ups_dueAt_completedAt_idx" ON "job_follow_ups"("dueAt", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_templates_orgId_name_key" ON "inspection_templates"("orgId", "name");

-- CreateIndex
CREATE INDEX "inspection_template_sections_templateId_sortOrder_idx" ON "inspection_template_sections"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "inspection_template_items_sectionId_sortOrder_idx" ON "inspection_template_items"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "inspections_jobId_idx" ON "inspections"("jobId");

-- CreateIndex
CREATE INDEX "inspection_results_inspectionId_sortOrder_idx" ON "inspection_results"("inspectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "inspection_results_severity_idx" ON "inspection_results"("severity");

-- CreateIndex
CREATE INDEX "inspection_photos_resultId_idx" ON "inspection_photos"("resultId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_supersedesId_key" ON "estimates"("supersedesId");

-- CreateIndex
CREATE INDEX "estimates_orgId_status_idx" ON "estimates"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_jobId_version_key" ON "estimates"("jobId", "version");

-- CreateIndex
CREATE INDEX "estimate_lines_estimateId_sortOrder_idx" ON "estimate_lines"("estimateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_shares_tokenHash_key" ON "estimate_shares"("tokenHash");

-- CreateIndex
CREATE INDEX "estimate_shares_estimateId_idx" ON "estimate_shares"("estimateId");

-- CreateIndex
CREATE INDEX "estimate_approvals_estimateId_idx" ON "estimate_approvals"("estimateId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_orgId_name_key" ON "tax_rates"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_orgId_kind_key" ON "document_sequences"("orgId", "kind");

-- CreateIndex
CREATE INDEX "invoices_orgId_status_idx" ON "invoices"("orgId", "status");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_orgId_number_key" ON "invoices"("orgId", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoiceId_sortOrder_idx" ON "invoice_lines"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "payments_orgId_receivedAt_idx" ON "payments"("orgId", "receivedAt");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_orgId_number_key" ON "credit_notes"("orgId", "number");

-- CreateIndex
CREATE INDEX "message_logs_orgId_createdAt_idx" ON "message_logs"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "message_logs_relatedType_relatedId_idx" ON "message_logs"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "service_schedules_vehicleId_idx" ON "service_schedules"("vehicleId");

-- CreateIndex
CREATE INDEX "service_schedules_dueAt_isActive_idx" ON "service_schedules"("dueAt", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_orgId_name_key" ON "product_categories"("orgId", "name");

-- CreateIndex
CREATE INDEX "products_orgId_isActive_idx" ON "products"("orgId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "products_orgId_partNumber_key" ON "products"("orgId", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_orgId_code_key" ON "warehouses"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_productId_warehouseId_key" ON "stock_levels"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_orgId_createdAt_idx" ON "stock_movements"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_reservations_productId_releasedAt_idx" ON "stock_reservations"("productId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_orgId_name_key" ON "suppliers"("orgId", "name");

-- CreateIndex
CREATE INDEX "purchase_requests_orgId_status_idx" ON "purchase_requests"("orgId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_orgId_status_idx" ON "purchase_orders"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_orgId_number_key" ON "purchase_orders"("orgId", "number");

-- CreateIndex
CREATE INDEX "purchase_order_lines_orderId_idx" ON "purchase_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "goods_receipts_orderId_idx" ON "goods_receipts"("orderId");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_receiptId_idx" ON "goods_receipt_lines"("receiptId");

-- CreateIndex
CREATE INDEX "supplier_bills_orgId_status_idx" ON "supplier_bills"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bills_orgId_reference_key" ON "supplier_bills"("orgId", "reference");

-- CreateIndex
CREATE INDEX "accounts_orgId_type_idx" ON "accounts"("orgId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_orgId_code_key" ON "accounts"("orgId", "code");

-- CreateIndex
CREATE INDEX "fiscal_periods_orgId_startsAt_idx" ON "fiscal_periods"("orgId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_orgId_name_key" ON "fiscal_periods"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversesId_key" ON "journal_entries"("reversesId");

-- CreateIndex
CREATE INDEX "journal_entries_orgId_postedAt_idx" ON "journal_entries"("orgId", "postedAt");

-- CreateIndex
CREATE INDEX "journal_entries_sourceType_sourceId_idx" ON "journal_entries"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "journal_lines_entryId_idx" ON "journal_lines"("entryId");

-- CreateIndex
CREATE INDEX "journal_lines_accountId_idx" ON "journal_lines"("accountId");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bays" ADD CONSTRAINT "bays_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_recordedByOrgId_fkey" FOREIGN KEY ("recordedByOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "vehicle_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_event_attachments" ADD CONSTRAINT "vehicle_event_attachments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "vehicle_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownerships" ADD CONSTRAINT "vehicle_ownerships_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_ownerships" ADD CONSTRAINT "vehicle_ownerships_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_recordedByOrgId_fkey" FOREIGN KEY ("recordedByOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_access_grants" ADD CONSTRAINT "vehicle_access_grants_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_access_grants" ADD CONSTRAINT "vehicle_access_grants_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_access_grants" ADD CONSTRAINT "vehicle_access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_shares" ADD CONSTRAINT "passport_shares_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_shares" ADD CONSTRAINT "passport_shares_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_share_accesses" ADD CONSTRAINT "passport_share_accesses_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "passport_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_recalls" ADD CONSTRAINT "vehicle_recalls_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_recalls" ADD CONSTRAINT "vehicle_recalls_recallId_fkey" FOREIGN KEY ("recallId") REFERENCES "recalls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_types" ADD CONSTRAINT "job_types_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "bays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_billToCustomerId_fkey" FOREIGN KEY ("billToCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "bays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_technicians" ADD CONSTRAINT "job_technicians_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_technicians" ADD CONSTRAINT "job_technicians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_job_types" ADD CONSTRAINT "job_job_types_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_job_types" ADD CONSTRAINT "job_job_types_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "job_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_events" ADD CONSTRAINT "job_status_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_events" ADD CONSTRAINT "job_status_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_doneByUserId_fkey" FOREIGN KEY ("doneByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_labour_lines" ADD CONSTRAINT "job_labour_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_labour_lines" ADD CONSTRAINT "job_labour_lines_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_lines" ADD CONSTRAINT "job_part_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_lines" ADD CONSTRAINT "job_part_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_part_lines" ADD CONSTRAINT "job_part_lines_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_fee_lines" ADD CONSTRAINT "job_fee_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_fee_lines" ADD CONSTRAINT "job_fee_lines_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_attachments" ADD CONSTRAINT "job_attachments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_attachments" ADD CONSTRAINT "job_attachments_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_follow_ups" ADD CONSTRAINT "job_follow_ups_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_follow_ups" ADD CONSTRAINT "job_follow_ups_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_templates" ADD CONSTRAINT "inspection_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_template_sections" ADD CONSTRAINT "inspection_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "inspection_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_template_items" ADD CONSTRAINT "inspection_template_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "inspection_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "inspection_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "inspection_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "inspection_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_inspectionResultId_fkey" FOREIGN KEY ("inspectionResultId") REFERENCES "inspection_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_shares" ADD CONSTRAINT "estimate_shares_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_approvals" ADD CONSTRAINT "estimate_approvals_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_schedules" ADD CONSTRAINT "service_schedules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_schedules" ADD CONSTRAINT "service_schedules_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_jobPartLineId_fkey" FOREIGN KEY ("jobPartLineId") REFERENCES "job_part_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "purchase_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
