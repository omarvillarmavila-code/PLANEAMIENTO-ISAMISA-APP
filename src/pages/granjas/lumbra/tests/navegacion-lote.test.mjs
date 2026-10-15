// Instalar react-test-renderer@18.3.1 en una carpeta temporal y apuntar
// GRANJA_REACT_RENDERER_MODULE a su index.js. No conecta a Supabase.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
assert.ok(process.env.GRANJA_REACT_RENDERER_MODULE, 'Falta GRANJA_REACT_RENDERER_MODULE');
const mocks = {
  database: `export const supabase = { schema: () => globalThis.__loteTestDatabase, rpc: (name) => globalThis.__loteTestDatabase.from(name) };`,
  period: `import React from 'react'; export default function Period({ onChange }) {
    React.useEffect(() => onChange({ year: '2026', week: '25' }), [onChange]); return null;
  }`,
  empty: `export default function Empty() { return null; }`,
  detail: `import React from 'react'; export default function Detail(props) { return React.createElement('detail-chart', props); }`,
  charts: `import React from 'react';
    const Data = React.createContext([]);
    export function BarChart({ data, children }) { return React.createElement(Data.Provider, { value: data }, React.createElement('chart', { data }, children)); }
    export function XAxis(props) {
      const data = React.useContext(Data);
      return React.createElement('axis', props, typeof props.tick === 'function'
        ? data.map((row, index) => React.createElement(React.Fragment, { key: index }, props.tick({ x: index, y: 0, index, payload: { value: row.lote } }))) : null);
    }
    export const Bar='bar', CartesianGrid='grid', LabelList='labels', Legend='legend',
      Line='line', Tooltip='tooltip', YAxis='yaxis', Rectangle='rectangle';
    export function ResponsiveContainer({ children }) { return children; }
  `,
};
const result = await build({
  stdin: {
    contents: readFileSync(new URL('./navegacion-lote.fixture.jsx', import.meta.url), 'utf8'),
    resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'jsx',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.css': 'empty' },
  plugins: [{ name: 'navigation-test', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: require.resolve('react'), external: true }));
    build.onResolve({ filter: /^react-test-renderer$/ }, () => ({ path: process.env.GRANJA_REACT_RENDERER_MODULE }));
    build.onResolve({ filter: /supabase$/ }, () => ({ path: 'database', namespace: 'mock' }));
    build.onResolve({ filter: /01\.Filtro_Semana_Granja$/ }, () => ({ path: 'period', namespace: 'mock' }));
    build.onResolve({ filter: /02\.Tarjeta_poblacion_por_etapa$|01\.Selector_de_lote$|02\.Detalle_de_saldos_por_lote$/ }, () => ({ path: 'empty', namespace: 'mock' }));
    build.onResolve({ filter: /0[2-5]\.Grafica_/ }, () => ({ path: 'detail', namespace: 'mock' }));
    build.onResolve({ filter: /^recharts$/ }, () => ({ path: 'charts', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'jsx', resolveDir: process.cwd() }));
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
await module.exports.verifyNavigation();
