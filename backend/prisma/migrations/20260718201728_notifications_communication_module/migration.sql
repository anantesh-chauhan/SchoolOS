-- CreateEnum
CREATE TYPE "CommunicationCategory" AS ENUM ('GENERAL', 'SYSTEM', 'SECURITY', 'ACADEMIC', 'EXAM', 'RESULT', 'FEE', 'ATTENDANCE', 'HOMEWORK', 'RESOURCE', 'TRANSPORT', 'EVENT', 'HOLIDAY', 'ADMISSION', 'SPORTS', 'EMERGENCY', 'STAFF', 'PARENT', 'STUDENT', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CANCELLED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AudienceKind" AS ENUM ('DIRECT', 'ROLE', 'SCHOOL_WIDE', 'STAFF', 'CLASS', 'SECTION', 'SUBJECT', 'PARENT_OF_STUDENT', 'AUTOMATED_RULE', 'SAVED_GROUP');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'WEB_SOCKET');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'PARENT_TEACHER', 'STUDENT_TEACHER', 'ADMIN_STAFF', 'FEE_SUPPORT', 'ACADEMIC_SUPPORT', 'GROUP', 'SYSTEM_SUPPORT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'SYSTEM', 'ANNOUNCEMENT_REFERENCE', 'HOMEWORK_REFERENCE', 'FEE_REFERENCE', 'ATTENDANCE_REFERENCE');

-- CreateEnum
CREATE TYPE "DigestMode" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'NONE');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('WEB', 'IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "academicSessionId" TEXT,
    "type" TEXT NOT NULL,
    "category" "CommunicationCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "shortMessage" TEXT,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "icon" TEXT,
    "imageUrl" TEXT,
    "sourceModule" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "createdByUserId" TEXT,
    "createdByRole" "Role",
    "status" "NotificationStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "acknowledgementDeadline" TIMESTAMP(3),
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "allowReply" BOOLEAN NOT NULL DEFAULT false,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "resolvedRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAudienceRule" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "kind" "AudienceKind" NOT NULL,
    "role" "Role",
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAudienceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "recipientKey" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "parentId" TEXT,
    "recipientRole" "Role" NOT NULL,
    "deliveryContext" "AudienceKind" NOT NULL,
    "context" JSONB,
    "seenAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgementNote" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationRecipientId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT,
    "notificationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "category" "CommunicationCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "acknowledgementDeadline" TIMESTAMP(3),
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "allowComments" BOOLEAN NOT NULL DEFAULT false,
    "allowReplies" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "subject" TEXT,
    "classId" TEXT,
    "sectionId" TEXT,
    "studentId" TEXT,
    "createdByKey" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "role" "Role" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "canReply" BOOLEAN NOT NULL DEFAULT true,
    "canManage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "senderKey" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole" "Role" NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "replyToMessageId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAttachment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "uploadedByKey" TEXT NOT NULL,
    "notificationId" TEXT,
    "announcementId" TEXT,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "publicId" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "userId" TEXT,
    "category" "CommunicationCategory" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsAppEnabled" BOOLEAN NOT NULL DEFAULT false,
    "digestMode" "DigestMode" NOT NULL DEFAULT 'IMMEDIATE',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "directMessagingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "studentToTeacherEnabled" BOOLEAN NOT NULL DEFAULT true,
    "parentToTeacherEnabled" BOOLEAN NOT NULL DEFAULT true,
    "teacherToParentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "studentRepliesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "parentRepliesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "groupCreationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedAttachmentTypes" TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::TEXT[],
    "maximumAttachmentBytes" INTEGER NOT NULL DEFAULT 10485760,
    "maximumAttachmentCount" INTEGER NOT NULL DEFAULT 5,
    "messageEditingWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "messageDeletionWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "communicationRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "emergencyBypassesQuietHours" BOOLEAN NOT NULL DEFAULT true,
    "readReceiptsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgementEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsAppDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "moderationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "blockedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maximumRecipientsPerMessage" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "CommunicationCategory" NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "shortBodyTemplate" TEXT,
    "allowedVariables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAudit" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "actorKey" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previous" JSONB,
    "current" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_schoolId_status_publishedAt_idx" ON "Notification"("schoolId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Notification_schoolId_category_createdAt_idx" ON "Notification"("schoolId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_scheduledAt_status_idx" ON "Notification"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "Notification_sourceModule_sourceEntityType_sourceEntityId_idx" ON "Notification"("sourceModule", "sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_schoolId_dedupeKey_key" ON "Notification"("schoolId", "dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationAudienceRule_notificationId_kind_idx" ON "NotificationAudienceRule"("notificationId", "kind");

-- CreateIndex
CREATE INDEX "NotificationRecipient_schoolId_recipientKey_readAt_createdA_idx" ON "NotificationRecipient"("schoolId", "recipientKey", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_notificationId_acknowledgedAt_idx" ON "NotificationRecipient"("notificationId", "acknowledgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_recipientKey_key" ON "NotificationRecipient"("notificationId", "recipientKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextRetryAt_idx" ON "NotificationDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_status_createdAt_idx" ON "NotificationDelivery"("channel", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationRecipientId_channel_key" ON "NotificationDelivery"("notificationRecipientId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_notificationId_key" ON "Announcement"("notificationId");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_status_publishAt_idx" ON "Announcement"("schoolId", "status", "publishAt");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_category_createdAt_idx" ON "Announcement"("schoolId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_schoolId_status_lastMessageAt_idx" ON "Conversation"("schoolId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_schoolId_classId_sectionId_idx" ON "Conversation"("schoolId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_participantKey_leftAt_conversationI_idx" ON "ConversationParticipant"("participantKey", "leftAt", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_participantKey_key" ON "ConversationParticipant"("conversationId", "participantKey");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_schoolId_senderKey_createdAt_idx" ON "Message"("schoolId", "senderKey", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationAttachment_schoolId_notificationId_idx" ON "CommunicationAttachment"("schoolId", "notificationId");

-- CreateIndex
CREATE INDEX "CommunicationAttachment_schoolId_announcementId_idx" ON "CommunicationAttachment"("schoolId", "announcementId");

-- CreateIndex
CREATE INDEX "CommunicationAttachment_schoolId_messageId_idx" ON "CommunicationAttachment"("schoolId", "messageId");

-- CreateIndex
CREATE INDEX "NotificationPreference_schoolId_recipientKey_idx" ON "NotificationPreference"("schoolId", "recipientKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_schoolId_recipientKey_category_key" ON "NotificationPreference"("schoolId", "recipientKey", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPolicy_schoolId_key" ON "CommunicationPolicy"("schoolId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_schoolId_category_isActive_idx" ON "NotificationTemplate"("schoolId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_schoolId_code_channel_key" ON "NotificationTemplate"("schoolId", "code", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_schoolId_recipientKey_isActive_idx" ON "DeviceToken"("schoolId", "recipientKey", "isActive");

-- CreateIndex
CREATE INDEX "CommunicationAudit_schoolId_createdAt_idx" ON "CommunicationAudit"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationAudit_schoolId_entityType_entityId_idx" ON "CommunicationAudit"("schoolId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "NotificationAudienceRule" ADD CONSTRAINT "NotificationAudienceRule_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationRecipientId_fkey" FOREIGN KEY ("notificationRecipientId") REFERENCES "NotificationRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
