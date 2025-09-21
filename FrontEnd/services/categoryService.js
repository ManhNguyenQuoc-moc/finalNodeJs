const categoriesDB = [
  { id: 1, name: 'Áo thun', imageUrl: '/mixishop/images/cat1.jpg', status: 1 },
  { id: 2, name: 'Quần jeans', imageUrl: '/mixishop/images/cat2.jpg', status: 1 }
];

exports.getAllActiveCategories = () => categoriesDB.filter(c => c.status === 1);
