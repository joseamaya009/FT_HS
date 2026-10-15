import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

import { HidroSmartWebView } from './components/HidroSmartWebView';
import { MobileShell } from './components/MobileShell';
import { colors } from './constants/colors';

export default function App() {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    void NavigationBar.setBackgroundColorAsync(colors.navigationBar);
    void NavigationBar.setButtonStyleAsync('light');
  }, []);

  return (
    <MobileShell>
      <HidroSmartWebView />
    </MobileShell>
  );
}
