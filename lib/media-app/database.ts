import { supabase } from "@/lib/supabase/client";
import { createMediaDatabaseOperations } from "./database-operations";

export type {
  MediaSiteDatabaseRow,
  CreateMediaSiteInput,
  MediaPublicationAttestation,
  MediaArticleDraftInput,
  MediaArticleDraftDatabaseRow
} from "./database-operations";

export const {
  createMediaSiteInDatabase,
  listMyMediaSitesFromDatabase,
  publishMediaArticleInDatabase,
  unpublishMediaArticleInDatabase,
  createMediaArticleDraftInDatabase,
  readMediaArticleDraftFromDatabase,
  updateMediaArticleDraftInDatabase,
  mediaDatabaseTransport
} = createMediaDatabaseOperations(supabase);
