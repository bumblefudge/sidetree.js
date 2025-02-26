import type { NextApiResponse } from 'next';

import withService from '../../../../middleware/withService';

import { SidetreeApiRequest } from '../../../../middleware/sidetree';

type Data = { transactions: any };

const handler = async (req: SidetreeApiRequest, res: NextApiResponse<Data>) => {
  const sidetree = await req.client.server.service.sidetree;
  if (req.method === 'GET') {
    const results: any = await sidetree.getTransactions();
    res.status(200).json(results);
  }
};

export default withService(handler);
