/*
 * Copyright 2020 - Transmute Industries Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { TransactionModel, Encoder } from '@sidetree/common';
import { AnchoredDataSerializer } from '@sidetree/core';
import Web3 from 'web3';
import { EthereumBlock, ElementEventData } from './types';

const getAccounts = (web3: Web3): Promise<Array<string>> =>
  new Promise((resolve, reject) => {
    web3.eth.getAccounts((err: Error, accounts: string[]) => {
      if (err) {
        reject(err);
      }
      resolve(accounts);
    });
  });

const eventLogToSidetreeTransaction = (
  log: ElementEventData
): TransactionModel => {
  const coreIndexFileUri = Encoder.encode(
    Buffer.from(
      '1220' + log.returnValues.anchorFileHash.replace('0x', ''),
      'hex'
    )
  );
  const anchorObject = {
    coreIndexFileUri,
    numberOfOperations: Number.parseInt(log.returnValues.numberOfOperations),
  };
  const anchorString = AnchoredDataSerializer.serialize(anchorObject);
  return {
    transactionNumber: Number.parseInt(log.returnValues.transactionNumber, 10),
    transactionTime: log.blockNumber,
    transactionTimeHash: log.blockHash,
    anchorString,
    transactionFeePaid: 0,
    normalizedTransactionFee: 0,
    writer: 'writer',
  };
};

const getBlock = async (
  web3: Web3,
  blockHashOrBlockNumber: string | number
): Promise<EthereumBlock> => {
  const block: EthereumBlock = await new Promise((resolve, reject) => {
    web3.eth.getBlock(
      blockHashOrBlockNumber,
      (err: Error, b: EthereumBlock) => {
        if (err) {
          reject(err);
        }
        resolve(b);
      }
    );
  });
  return block;
};

const getBlockchainTime = async (
  web3: Web3,
  blockHashOrBlockNumber: string | number
): Promise<string | number | null> => {
  const block: EthereumBlock = await getBlock(web3, blockHashOrBlockNumber);
  if (block) {
    return block.timestamp;
  }
  return null;
};

const extendSidetreeTransactionWithTimestamp = async (
  web3: Web3,
  txns: TransactionModel[]
): Promise<TransactionModel[]> => {
  return Promise.all(
    txns.map(async (txn) => {
      const timestamp = await getBlockchainTime(web3, txn.transactionTime);
      if (typeof timestamp === 'number') {
        return {
          ...txn,
          transactionTimestamp: timestamp,
        };
      }
      return txn;
    })
  );
};

export default {
  eventLogToSidetreeTransaction,
  extendSidetreeTransactionWithTimestamp,
  getAccounts,
  getBlock,
  getBlockchainTime,
};
