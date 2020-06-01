import * as crypto from 'crypto';
import JwkEs256k from '../src/models/JwkEs256k';
import PublicKeyModel from '../src/models/PublicKeyModel';
import OperationType from '../src/enums/OperationType';
import PublicKeyUsage from '../src/enums/PublicKeyUsage';
import Jwk from '../src/util/Jwk';
import Jws from '../src/util/Jws';
import Multihash from '../src/util/Multihash';
import Encoder from '../src/util/Encoder';
import CreateOperation from '../src/CreateOperation';
import UpdateOperation from '../src/UpdateOperation';

export const generateCommitRevealPair = () => {
  const revealValueBuffer = crypto.randomBytes(32);
  const revealValueEncodedString = Encoder.encode(revealValueBuffer);
  const commitmentHash = Multihash.hash(revealValueBuffer);
  const commitmentHashEncodedString = Encoder.encode(commitmentHash);
  return [revealValueEncodedString, commitmentHashEncodedString];
}

const generateCreateOperationRequest = async (
  recoveryPublicKey: JwkEs256k,
  signingPublicKey: PublicKeyModel,
  nextUpdateCommitment: string
) => {
  const document = {
    publicKeys: [signingPublicKey],
  };

  const patches = [
    {
      action: 'replace',
      document,
    },
  ];

  const delta = {
    update_commitment: nextUpdateCommitment,
    patches,
  };

  const deltaBuffer = Buffer.from(JSON.stringify(delta));
  const deltaHash = Encoder.encode(Multihash.hash(deltaBuffer));

  const suffixData = {
    delta_hash: deltaHash,
    recovery_commitment: await Multihash.canonicalizeThenHashThenEncode(
      recoveryPublicKey
    ),
  };

  const suffixDataEncodedString = Encoder.encode(JSON.stringify(suffixData));
  const deltaEncodedString = Encoder.encode(deltaBuffer);
  const operation = {
    type: OperationType.Create,
    suffix_data: suffixDataEncodedString,
    delta: deltaEncodedString,
  };

  return operation;
};

  /**
   * Generates SECP256K1 key pair to be used in an operation. If usage not supplied, all usages will be included
   * Mainly used for testing.
   * @returns [publicKey, privateKey]
   */
const generateKeyPair = async (id: string, usage?: string[]): Promise<[PublicKeyModel, JwkEs256k]> => {
    const [publicKey, privateKey] = await Jwk.generateEs256kKeyPair();
    const publicKeyModel = {
      id,
      type: 'EcdsaSecp256k1VerificationKey2019',
      jwk: publicKey,
      usage: usage || Object.values(PublicKeyUsage)
    };

    return [publicKeyModel, privateKey];
  }

export interface ICreateOperationData {
  createOperation: CreateOperation;
  operationRequest: {
      type: OperationType;
      suffix_data: string;
      delta: string;
  };
  recoveryPublicKey: any;
  recoveryPrivateKey: any;
  signingKeyId: string;
  signingPublicKey: PublicKeyModel;
  signingPrivateKey: JwkEs256k;
  nextUpdateRevealValueEncodedString: string;
};

export const generateCreateOperation: () => Promise<ICreateOperationData> = async () => {
  const signingKeyId = 'signingKey';
  const [recoveryPublicKey, recoveryPrivateKey] = await Jwk.generateEs256kKeyPair();
  const [signingPublicKey, signingPrivateKey] = await generateKeyPair(signingKeyId);

  // Generate the next update and recover operation commitment hash reveal value pair.
  const [nextUpdateRevealValueEncodedString, nextUpdateCommitmentHash] = generateCommitRevealPair();

  const operationRequest = await generateCreateOperationRequest(
    recoveryPublicKey,
    signingPublicKey,
    nextUpdateCommitmentHash
  );

  const operationBuffer = Buffer.from(JSON.stringify(operationRequest));
  const createOperation = await CreateOperation.parse(operationBuffer);

  return {
    createOperation,
    operationRequest,
    recoveryPublicKey,
    recoveryPrivateKey,
    signingKeyId,
    signingPublicKey,
    signingPrivateKey,
    nextUpdateRevealValueEncodedString
  };
}

// Update
const signUsingEs256k = async (
  payload: any,
  privateKey: JwkEs256k,
  signingKeyId?: string
): Promise<string> => {
  const protectedHeader = {
    kid: signingKeyId,
    alg: 'ES256K',
  };

  const compactJws = Jws.signAsCompactJws(payload, privateKey, protectedHeader);
  return compactJws;
};


const createUpdateOperationRequest = async (
  didUniqueSuffix: string,
  updateRevealValue: string,
  nextUpdateCommitmentHash: string,
  patches: any,
  signingKeyId: string,
  signingPrivateKey: JwkEs256k
) => {
  const delta = {
    patches,
    update_commitment: nextUpdateCommitmentHash
  };
  const deltaJsonString = JSON.stringify(delta);
  const deltaHash = Encoder.encode(Multihash.hash(Buffer.from(deltaJsonString)));
  const encodedDeltaString = Encoder.encode(deltaJsonString);

  const signedDataPayloadObject = {
    update_reveal_value: updateRevealValue,
    delta_hash: deltaHash
  };
  const signedData = await signUsingEs256k(signedDataPayloadObject, signingPrivateKey, signingKeyId);

  const updateOperationRequest = {
    type: OperationType.Update,
    did_suffix: didUniqueSuffix,
    delta: encodedDeltaString,
    signed_data: signedData
  };

  return updateOperationRequest;
}

const createUpdateOperationRequestForAddingAKey = async (
  didUniqueSuffix: string,
  updateRevealValue: string,
  newPublicKey: PublicKeyModel,
  nextUpdateCommitmentHash: string,
  signingKeyId: string,
  signingPrivateKey: JwkEs256k) => {

  const patches = [
    {
      action: 'add-public-keys',
      publicKeys: [
        newPublicKey
      ]
    }
  ];

  const updateOperationRequest = await createUpdateOperationRequest(
    didUniqueSuffix,
    updateRevealValue,
    nextUpdateCommitmentHash,
    patches,
    signingKeyId,
    signingPrivateKey
  );

  return updateOperationRequest;
}
  /**
   * Generates an update operation that adds a new key.
   */
export const generateUpdateOperation = async (
  didUniqueSuffix: string,
  updateRevealValue: string,
  updatePrivateKeyId: string,
  updatePrivateKey: JwkEs256k
) => {
  const additionalKeyId = `additional-key`;
  const [
    additionalPublicKey,
    additionalPrivateKey,
  ] = await generateKeyPair(additionalKeyId);
  const [
    nextUpdateRevealValue,
    nextUpdateCommitValue,
  ] = generateCommitRevealPair();

  const operationJson = await createUpdateOperationRequestForAddingAKey(
    didUniqueSuffix,
    updateRevealValue,
    additionalPublicKey,
    nextUpdateCommitValue,
    updatePrivateKeyId,
    updatePrivateKey
  );

  const operationBuffer = Buffer.from(JSON.stringify(operationJson));
  const updateOperation = await UpdateOperation.parse(operationBuffer);

  return {
    updateOperation,
    operationBuffer,
    additionalKeyId,
    additionalPublicKey,
    additionalPrivateKey,
    nextUpdateRevealValue,
  };
};
