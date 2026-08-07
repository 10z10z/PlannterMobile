import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import useForm from '../../hooks/useForm';
import { loginSchema } from '../../lib/schemas';
import { messageFor } from '../../lib/errors';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const form = useForm(loginSchema);
  const resetForm = form.reset;

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    resetForm({ email: '', password: '' });
  }, [resetForm]);

  const handleLogin = () => {
    setError('');
    form.submit(async (values) => {
      setLoading(true);
      const { error: failure } = await signIn(values.email, values.password);
      setLoading(false);
      // Through `messageFor` like everything else: GoTrue's own wording is
      // sometimes fine and sometimes "AuthApiError: Invalid login credentials",
      // and this is the screen where a bad message costs the most.
      if (failure) setError(messageFor(failure));
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="displaySmall" style={styles.logo}>
        🌱 Plannter
      </Text>
      <Text variant="titleMedium" style={styles.title}>
        Welcome back
      </Text>

      <FormField
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        {...form.field('email')}
      />
      <FormField
        label="Password"
        secureTextEntry
        autoComplete="current-password"
        {...form.field('password')}
      />
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loading}
        disabled={loading || !form.canSubmit}
      >
        Log in
      </Button>
      <Button onPress={() => navigation.navigate('Signup')} style={styles.linkButton}>
        Don’t have an account? Sign up
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
  linkButton: {
    marginTop: 8,
  },
});
