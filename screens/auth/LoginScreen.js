import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <View style={styles.container}>
      <Text variant="displaySmall" style={styles.logo}>🌱 Plannter</Text>
      <Text variant="titleMedium" style={styles.title}>Welcome back</Text>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      <Button mode="contained" onPress={handleLogin} loading={loading} disabled={loading}>
        Log in
      </Button>
      <Button onPress={() => navigation.navigate('Signup')} style={styles.linkButton}>
        Don't have an account? Sign up
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
  input: {
    marginBottom: 8,
  },
  linkButton: {
    marginTop: 8,
  },
});
