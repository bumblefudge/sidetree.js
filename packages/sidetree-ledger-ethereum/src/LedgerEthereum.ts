import utils from './utils';
import {
  IBlockchain,
  TransactionModel,
  BlockchainTimeModel,
} from '@sidetree/common';

const contract = require('@truffle/contract');
const anchorContractArtifact = require('../build/contracts/SimpleSidetreeAnchor.json');

export class LedgerEthereum implements IBlockchain {
  public anchorContractAddress?: string;
  private logger: any;
  public anchorContract: any;
  public resolving: any;
  public instance: any;
  private cachedBlockchainTime: BlockchainTimeModel = { hash: '', time: 0 };

  constructor(public web3: any, public contractAddress?: string, logger?: any) {
    this.logger = logger || console;
    this.anchorContract = contract(anchorContractArtifact);
    this.anchorContract.setProvider(this.web3.currentProvider);

    if (contractAddress) {
      this.anchorContractAddress = contractAddress;
    } else {
      this.resolving = this._createNewContract().then((instance: any) => {
        this.anchorContract.setProvider(this.web3.currentProvider);
        this.anchorContractAddress = instance.address;
      });
    }
  }

  public _getTransactions = async (
    fromBlock: number | string,
    toBlock: number | string,
    options?: any
  ): Promise<TransactionModel[]> => {
    const instance = await this._getInstance();
    const logs = await instance.getPastEvents('Anchor', {
      fromBlock,
      toBlock: toBlock || 'latest',
    });
    const txns = logs.map(utils.eventLogToSidetreeTransaction);
    if (options && options.omitTimestamp) {
      return txns;
    }
    return this.extendSidetreeTransactionWithTimestamp(txns);
  };

  public async read(
    sinceTransactionNumber?: number,
    _transactionTimeHash?: string
  ): Promise<{ moreTransactions: boolean; transactions: TransactionModel[] }> {
    const options = {
      omitTimestamp: true,
    };
    let transactions: TransactionModel[];
    if (_transactionTimeHash) {
      transactions = await this._getTransactions(
        _transactionTimeHash,
        _transactionTimeHash,
        options
      );
    }
    if (sinceTransactionNumber) {
      transactions = await this._getTransactions(
        sinceTransactionNumber,
        'latest',
        options
      );
    }
    transactions = await this._getTransactions(0, 'latest', options);
    return {
      moreTransactions: false,
      transactions,
    };
  }

  public async getFirstValidTransaction(
    _transactions: TransactionModel[]
  ): Promise<TransactionModel | undefined> {
    return undefined;
  }

  public get approximateTime(): BlockchainTimeModel {
    return this.cachedBlockchainTime;
  }

  public async getLatestTime(): Promise<BlockchainTimeModel> {
    const block: any = await new Promise((resolve, reject) => {
      this.web3.eth.getBlock('latest', (err: Error, b: any) => {
        if (err) {
          reject(err);
        }
        resolve(b);
      });
    });
    const blockchainTime: BlockchainTimeModel = {
      time: block.number,
      hash: block.hash,
    };
    this.cachedBlockchainTime = blockchainTime;
    return blockchainTime;
  }

  public _createNewContract = async (fromAddress?: string) => {
    const from = fromAddress || (await utils.getAccounts(this.web3))[0];
    const instance = await utils.retryWithLatestTransactionCount(
      this.web3,
      this.anchorContract.new,
      [],
      {
        from,
        // TODO: Bad hard coded value, use gasEstimate
        gas: 4712388,
      }
    );
    this.anchorContractAddress = instance.address;
    this.logger.log('_createNewContract', this.anchorContractAddress);
    return instance;
  };

  public _getInstance: any = async () => {
    if (!this.instance) {
      this.instance = await this.anchorContract.at(this.anchorContractAddress);
    }
    return this.instance;
  };

  public getBlockchainTime = async (blockHashOrBlockNumber: any) => {
    return utils.getBlockchainTime(this.web3, blockHashOrBlockNumber);
  };

  public extendSidetreeTransactionWithTimestamp = async (
    txns: any
  ): Promise<TransactionModel[]> => {
    return Promise.all(
      txns.map(async (txn: any) => {
        const timestamp = await utils.getBlockchainTime(
          this.web3,
          txn.transactionTime
        );
        return {
          ...txn,
          transactionTimestamp: timestamp,
        };
      })
    );
  };

  public write = async (anchorFileHash: string): Promise<void> => {
    await this.resolving;
    const [from] = await utils.getAccounts(this.web3);
    const instance = await this._getInstance();
    const bytes32EncodedHash = utils.base58EncodedMultihashToBytes32(
      anchorFileHash
    );
    try {
      const receipt = await utils.retryWithLatestTransactionCount(
        this.web3,
        instance.anchorHash,
        [bytes32EncodedHash],
        {
          from,
          gasPrice: '100000000000',
        }
      );
      console.log(Boolean(receipt));
    } catch (e) {
      this.logger.error(e.message);
    }
  };
}
