-- CreateEnum
CREATE TYPE "ListeningHistorySource" AS ENUM ('TRACK_PAGE', 'ALBUM', 'PLAYLIST', 'SEARCH', 'QUEUE');

-- AlterTable
ALTER TABLE "ListeningHistory" ADD COLUMN     "source" "ListeningHistorySource";
