import globals from 'globals';
export default [{
  files:['src/**/*.{js,jsx}'],
  languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:globals.node,parserOptions:{ecmaFeatures:{jsx:true}}},
  rules:{'no-undef':'error','no-unreachable':'error','no-dupe-keys':'error','valid-typeof':'error','no-unsafe-finally':'error','no-constant-binary-expression':'error'}
}];
