import { decodeCSV, validateCSV, fingerprint } from './csv-granja';

self.onmessage = async ({ data: { buffer, schema } }) => {
  try {
    const { text } = decodeCSV(buffer);
    const result = validateCSV(text, schema);
    if (!result.errorCount) result.fingerprint = await fingerprint(result);
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error.message }); }
};
