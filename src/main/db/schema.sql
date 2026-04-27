-- FLUX schema completo (single source of truth para better-sqlite3 facade).
-- Aplicado idempotentemente en runtime via ensureSchema (db.ts).

CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" INTEGER NOT NULL DEFAULT 0,
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_name_key" ON "Profile"("name");

CREATE TABLE IF NOT EXISTS "AudioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "durationMs" INTEGER,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "fadeInMs" INTEGER,
    "fadeOutMs" INTEGER,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS "Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlaylistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "audioAssetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE,
    FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlaylistItem_playlistId_position_key" ON "PlaylistItem"("playlistId", "position");

CREATE TABLE IF NOT EXISTS "AdBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "AdBlockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adBlockId" TEXT NOT NULL,
    "audioAssetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    FOREIGN KEY ("adBlockId") REFERENCES "AdBlock"("id") ON DELETE CASCADE,
    FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdBlockItem_adBlockId_position_key" ON "AdBlockItem"("adBlockId", "position");

CREATE TABLE IF NOT EXISTS "AdRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "adBlockId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE,
    FOREIGN KEY ("adBlockId") REFERENCES "AdBlock"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "SoundboardButton" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "label" TEXT,
    "audioAssetId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'oneshot',
    "color" TEXT NOT NULL DEFAULT '#3a7bd5',
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE,
    FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "SoundboardButton_profileId_slotIndex_key" ON "SoundboardButton"("profileId", "slotIndex");

CREATE TABLE IF NOT EXISTS "RadioProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "playlistId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE,
    FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "OutputIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlayoutEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS "AudioEffectsConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "crossfadeEnabled" INTEGER NOT NULL DEFAULT 0,
    "crossfadeMs" INTEGER NOT NULL DEFAULT 2000,
    "crossfadeCurve" TEXT NOT NULL DEFAULT 'equal-power',
    "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AudioEffectsConfig_profileId_key" ON "AudioEffectsConfig"("profileId");
