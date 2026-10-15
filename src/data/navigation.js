export const navigation = [
  { label: 'Inicio', path: '/', icon: 'home' },
  { label: 'Granjas Aves', path: '/granjas-aves', icon: 'birds', children: [
    { label: 'Granja Lumbra', path: '/granjas-aves/lumbra', icon: 'hen' },
    { label: 'Granja Reparticion', path: '/granjas-aves/reparticion', icon: 'turkey' },
    { label: 'Granja Asia', path: '/granjas-aves/asia', icon: 'cooked-turkey' },
    { label: 'Granja Carabayllo', path: '/granjas-aves/carabayllo', icon: 'young-chicken' },
  ]},
  { label: 'Planta de Incubacion', icon: 'eggs', children: [
    { label: 'Base 1 - Planta Ate', path: '/incubacion/ate', icon: 'factory' },
    { label: 'Base 3 - Planta Carapongo', path: '/incubacion/carapongo', icon: 'factory' },
  ]},
]
