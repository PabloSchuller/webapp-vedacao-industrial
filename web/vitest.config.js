import {defineConfig} from 'vitest/config';
export default defineConfig({
  test:{environment:'jsdom',include:['tests/**/*.spec.jsx'],coverage:{
    provider:'istanbul',reportsDirectory:'coverage/react',include:['src/**/*.{js,jsx}'],reporter:['text','html','lcov','json-summary'],
    thresholds:{lines:25}
  }}
});
