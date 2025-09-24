import Papa from 'papaparse';

self.onmessage = (event: MessageEvent<File>) => {
  const file = event.data;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    worker: false, // We are already in a worker
    transformHeader: (header) => {
      // Remove BOM character if present and trim whitespace
      const cleanedHeader = header.charCodeAt(0) === 0xFEFF ? header.slice(1) : header;
      return cleanedHeader.trim();
    },
    chunk: (results) => {
      // Post message back to the main thread with the chunk of data
      self.postMessage({ type: 'chunk', data: results.data });
    },
    complete: (results) => {
      // The `results.meta.cursor` gives the final row index, which is the total count.
      self.postMessage({ type: 'complete', count: results.meta.cursor });
    },
    error: (error: Error) => {
      self.postMessage({ type: 'error', error: error.message });
    },
  });
};
