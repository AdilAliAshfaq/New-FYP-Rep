export const Theme = {
  colors: {
    // The new solid background (light off-white)
    background: '#F5F5F7',
    
    // Gradient replaced with subtle light tints — keep as array so other code doesn't break
    backgroundGradient: ['#FFFFFF', '#F5F5F7', '#EFE8FF', '#E8DCFF'],
    
    surface: '#FFFFFF',        // Card/Input background — clean white
    primary: '#5E17EB',        // Vibrant purple accent
    primaryDark: '#4A11BC',    // Pressed/hover state
    primaryLight: '#E8DCFF',   // Soft purple tint for subtle fills
    secondary: '#6B7280',      // Muted gray text
    text: '#1A1A2E',           // Near-black for headings
    border: '#E5E7EB',         // Subtle light gray borders
    error: '#EF4444',
    success: '#10B981',
  },
  fonts: {
    regular: 'Archia-Regular',
    medium: 'Archia-Medium',
    semiBold: 'Archia-SemiBold',
    bold: 'Archia-Bold',
  }
};