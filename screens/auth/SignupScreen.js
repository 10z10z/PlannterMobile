import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';

export default function SignupScreen({ navigation }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    const { data, error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data?.session) {
      setInfo('Check your email to confirm your account, then log in.');
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="displaySmall" style={styles.logo}>🌱 Plannter</Text>
      <Text variant="titleMedium" style={styles.title}>Create account</Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
      <HelperText type="info" visible={!!info}>
        {info}
      </HelperText>

      <Button mode="contained" onPress={handleSignup} loading={loading} disabled={loading}>
        Sign up
      </Button>
      <Button onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
        Already have an account? Log in
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
  },
  input: {
    marginBottom: 8,
  },
  linkButton: {
    marginTop: 8,
  },
});
