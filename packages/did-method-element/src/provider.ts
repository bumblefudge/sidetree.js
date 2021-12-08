import Web3 from 'web3';
import { EthereumLedger } from '@sidetree/ethereum';
import { IpfsCasWithCache } from '@sidetree/cas-ipfs';
import { MockCas } from '@sidetree/cas';
import Element from './Element';

type ElementNodeConfigs = {
  contentAddressableStoreServiceUri: string;
  databaseName: string;
  didMethodName: string;
  ethereumRpcUrl: string;
  mongoDbConnectionString: string;
  batchingIntervalInSeconds: number;
  observingIntervalInSeconds: number;
  maxConcurrentDownloads: number;
  versions: [
    {
      startingBlockchainTime: number;
      version: string;
    }
  ];
  elementAnchorContract?: string;
};

const getLedger = async (elementNodeConfigs: ElementNodeConfigs) => {
  const web3 = new Web3(elementNodeConfigs.ethereumRpcUrl);
  const ledger = new EthereumLedger(
    web3,
    elementNodeConfigs.elementAnchorContract
  );
  return ledger;
};

const getTestCas = async () => {
  const cas = new MockCas();
  return cas;
};

const getCas = async (config: ElementNodeConfigs) => {
  const cas = new IpfsCasWithCache(
    config.contentAddressableStoreServiceUri,
    config.mongoDbConnectionString + config.databaseName
  );
  return cas;
};

export const getTestNodeInstance = async (
  elementNodeConfigs: ElementNodeConfigs
) => {
  const ledger = await getLedger(elementNodeConfigs);
  const cas = await getTestCas();
  const element = new Element(
    elementNodeConfigs as any,
    elementNodeConfigs.versions,
    cas,
    ledger
  );
  await element.initialize();
  return element;
};

export const getNodeInstance = async (
  elementNodeConfigs: ElementNodeConfigs
) => {
  const ledger = await getLedger(elementNodeConfigs);
  const cas = await getCas(elementNodeConfigs);
  const element = new Element(
    elementNodeConfigs as any,
    elementNodeConfigs.versions,
    cas,
    ledger
  );
  await element.initialize();
  return element;
};
