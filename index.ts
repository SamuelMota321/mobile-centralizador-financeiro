import { registerRootComponent } from 'expo';

import App from './App';
import { applyTheme, DEFAULT_THEME } from './src/theme-preference';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
applyTheme(DEFAULT_THEME);
registerRootComponent(App);
