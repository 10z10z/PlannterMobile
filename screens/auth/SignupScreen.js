import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import useForm from '../../hooks/useForm';
import { signupSchema } from '../../lib/schemas';
import { useAuth } from '../../contexts/AuthContext';

export default function SignupScreen({ navigation }) {
  const { signUp } = useAuth();
  const form = useForm(signupSchema);
  const resetForm = form.reset;

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    resetForm({ email: '', password: '' });
  }, [resetForm]);

  const handleSignup = () => {
    setError('');
    setInfo('');
    form.submit(async (values) => {
      setLoading(true);
      const { data, error: failure } = await signUp(values.email, values.password);
      setLoading(false);
      if (failure) {
        setError(failure.message);
        return;
      }
      if (!data?.session) {
        setInfo('Check your email to confirm your account, then log in.');
      }
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="displaySmall" style={styles.logo}>
        🌱 Plannter
      </Text>
      <Text variant="titleMedium" style={styles.title}>
        Create account
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
        autoComplete="new-password"
        hint="At least 8 characters."
        {...form.field('password')}
      />
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
      <HelperText type="info" visible={!!info}>
        {info}
      </HelperText>

      <Button
        mode="contained"
        onPress={handleSignup}
        loading={loading}
        disabled={loading || !form.canSubmit}
      >
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
  linkButton: {
    marginTop: 8,
  },
});
