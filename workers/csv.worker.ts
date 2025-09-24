import Papa from 'papaparse';

self.onmessage = (event: MessageEvent<File>) => {
  const file = event.data;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    worker: false, // We are already in a worker
    chunk: (results) => {
      // Post message back to the main thread with the chunk of data
      // We transfer ownership of the data to avoid cloning, which is more efficient
      self.postMessage({ type: 'chunk', data: results.data });
    },
    complete: () => {
      self.postMessage({ type: 'complete' });
    },
    error: (error: Error) => {
      self.postMessage({ type: 'error', error: error.message });
    },
  });
};
