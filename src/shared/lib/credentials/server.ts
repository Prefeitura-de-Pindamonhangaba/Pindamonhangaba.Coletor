import { getDatabase } from "../db/client";
import { createCredentialRepository } from "../../../modules/credentials/models/credential-repository";
import { createCredentialService } from "../../../modules/credentials/services/credential-service";
export function getCredentialService() {
  return createCredentialService(createCredentialRepository(getDatabase()));
}
