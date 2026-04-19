import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { ScriptProvider } from './src/context/ScriptContext';
import AppBackground from './src/components/AppBackground';
import HomeScreen from './src/screens/HomeScreen';
import EditorScreen from './src/screens/EditorScreen';
import TeleprompterScreen from './src/screens/TeleprompterScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <ScriptProvider>
      <AppBackground>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" translucent={true} backgroundColor="transparent" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Editor" component={EditorScreen} />
            <Stack.Screen name="Teleprompter" component={TeleprompterScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AppBackground>
    </ScriptProvider>
  );
}