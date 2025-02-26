import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { AppPage } from '../../components/app-page';

import { RecentOperations } from '../../components/recent-operations';

import { Grid } from '@mui/material';

import { DidDocument } from '../../components/did-document';

import { Box, CircularProgress } from '@mui/material';
import {
  resolve,
  getOperations,
} from '../../services/sidetree-node-client-api';
import { uiConfigs } from '../../config';

export async function getServerSideProps(context: any) {
  return {
    props: uiConfigs,
  };
}

const Resolver: NextPage<any> = ({
  logoLight,
  logoDark,
  method,
  description,
}) => {
  const router = useRouter();

  const did = router.query.did as string;

  const [didDocument, setDidDocument] = useState();
  const [isLoading, setIsLoading] = useState(true);

  const [didDocumentOperations, setDidDocumentOperations] = useState([]);

  useEffect(() => {
    async function loadPageData() {
      if (did !== undefined) {
        const res1: any = await resolve(did);
        // FIXME: throwing 500
        // const res2: any = await getOperations(did);
        setDidDocument(res1.didDocument);
        // setDidDocumentOperations(res2.operations);
        setIsLoading(false);
      }
    }
    loadPageData();
  }, [did, setDidDocument, setIsLoading]);

  return (
    <div>
      <Head>
        <title>{method} | Resolve</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <AppPage logoLight={logoLight} logoDark={logoDark}>
          {isLoading && (
            <Box display="flex" justifyContent="center" sx={{ width: 1 }}>
              <CircularProgress />
            </Box>
          )}
          {!isLoading && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <DidDocument
                  didDocument={didDocument}
                  operationCount={didDocumentOperations.length}
                />
              </Grid>
              <Grid item xs={12}>
                <RecentOperations operations={didDocumentOperations} />
              </Grid>
            </Grid>
          )}
        </AppPage>
      </main>
    </div>
  );
};

export default Resolver;
