import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText } from 'react-native-paper';
import AuthLayout from './AuthLayout';
import FormField from '../../components/FormField';
import useForm from '../../hooks/useForm';
import { signupSchema } from '../../lib/schemas';
import { messageFor } from '../../lib/errors';
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
        // As on login: an address already registered and a password the server
        // thinks is weak both arrive here, and both deserve a sentence.
        setError(messageFor(failure));
        return;
      }
      if (!data?.session) {
        setInfo('Check your email to confirm your account, then log in.');
      }
    });
  };

  return (
    <AuthLayout title="Create an account">
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
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  linkButton: {
    marginTop: 8,
  },
});
