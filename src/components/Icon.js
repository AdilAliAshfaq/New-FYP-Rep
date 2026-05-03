import React from 'react';
import { View } from 'react-native';

// Import your specific SVG files
import ReplayIcon from '../assets/icons/round-replay.svg';
import SettingsIcon from '../assets/icons/settings-fill.svg';
import PlayIcon from '../assets/icons/play-fill.svg';
import PauseIcon from '../assets/icons/pause-fill.svg';
import FlipCameraIcon from '../assets/icons/baseline-flip-camera-android.svg';
import ShareIcon from '../assets/icons/share.svg'; // <-- NEW SHARE ICON


// Map simple string names to the imported SVG components
const ICONS = {
  'replay': ReplayIcon,
  'settings': SettingsIcon,
  'play': PlayIcon,
  'pause': PauseIcon, 
  'flip-camera': FlipCameraIcon,
  'share': ShareIcon, // <-- ADDED TO MAP
};

export default function Icon({ name, size = 24, color = '#000000', style }) {
  const SvgIcon = ICONS[name];

  if (!SvgIcon) {
    console.warn(`Icon "${name}" not found! Check your spelling in the ICONS object.`);
    // Returns a blank placeholder of the correct size so your UI doesn't collapse
    return <View style={[{ width: size, height: size }, style]} />;
  }

  return <SvgIcon width={size} height={size} fill={color} style={style} />;
}