import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ComingSoonScreen({ title, icon }) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon} size={48} style={styles.icon} />
      <Text variant="titleLarge" style={styles.title}>{title}</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    opacity: 0.4,
    marginBottom: 12,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.6,
  },
});
