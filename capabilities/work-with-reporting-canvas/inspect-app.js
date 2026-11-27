return {
  documents: (await api.getDocs()).map(doc => ({
    id: doc.id, name: doc.name, ownership: doc.ownership, shared: doc.shared,
  })),
  recipes: ['add-durable-behavior-with-a-board-script', 'custom-shape-config-js',
    'clickable-card-or-button-ui', 'get-data-from-a-service-with-a-connector',
    'scripts-on-a-shared-board'].map(id => ({ id, title: api.recipes[id].title })),
};
