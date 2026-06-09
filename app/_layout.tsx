import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, type TextProps } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useAuthStore } from '@/src/stores/auth';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

function hasFontFamily(style: TextProps['style']) {
  return Boolean(StyleSheet.flatten(style)?.fontFamily);
}

const AppText = Text as typeof Text & {
  defaultProps?: TextProps;
  render?: (props: TextProps, ref: unknown) => React.ReactElement | null;
  __eliteFontPatched?: boolean;
};
const defaultTextProps = AppText.defaultProps ?? {};
AppText.defaultProps = {
  ...defaultTextProps,
  style: [defaultTextProps.style, { fontFamily: fontFamilies.body }],
};

if (AppText.render && !AppText.__eliteFontPatched) {
  const originalRender = AppText.render;
  AppText.render = function renderWithEliteFont(props, ref) {
    const fontStyle = hasFontFamily(props.style)
      ? null
      : { fontFamily: fontFamilies.body, fontWeight: '400' as const };
    return originalRender.call(this, { ...props, style: [props.style, fontStyle] }, ref);
  };
  AppText.__eliteFontPatched = true;
}

const AppTextInput = TextInput as typeof TextInput & {
  defaultProps?: TextInputProps;
  render?: (props: TextInputProps, ref: unknown) => React.ReactElement | null;
  __eliteFontPatched?: boolean;
};
const defaultTextInputProps = AppTextInput.defaultProps ?? {};
AppTextInput.defaultProps = {
  ...defaultTextInputProps,
  style: [defaultTextInputProps.style, { fontFamily: fontFamilies.body, fontWeight: '400' }],
};

if (AppTextInput.render && !AppTextInput.__eliteFontPatched) {
  const originalTextInputRender = AppTextInput.render;
  AppTextInput.render = function renderTextInputWithEliteFont(props, ref) {
    const fontStyle = hasFontFamily(props.style)
      ? null
      : { fontFamily: fontFamilies.body, fontWeight: '400' as const };
    return originalTextInputRender.call(this, { ...props, style: [props.style, fontStyle] }, ref);
  };
  AppTextInput.__eliteFontPatched = true;
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const [fontsLoaded] = useFonts({
    'Cinzel-Regular': require('../assets/fonts/Cinzel-Regular.ttf'),
    'CinzelDecorative-Regular': require('../assets/fonts/CinzelDecorative-Regular.ttf'),
  });

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
