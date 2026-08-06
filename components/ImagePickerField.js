import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Button, Dialog, Portal, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { uploadImage } from '../lib/storage';
import ErrorText from './ErrorText';

/** @type {import('expo-image-picker').ImagePickerOptions} */
const IMAGE_OPTIONS = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true };

export default function ImagePickerField({ value, onChange, entity }) {
  const { session } = useAuth();
  const theme = useTheme();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handlePicked = async (result) => {
    if (result.canceled || !result.assets?.length) return;
    setDialogVisible(false);
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage({
        uri: result.assets[0].uri,
        userId: session.user.id,
        entity,
      });
      onChange(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Camera permission is required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(IMAGE_OPTIONS);
    handlePicked(result);
  };

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library permission is required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS);
    handlePicked(result);
  };

  return (
    <View>
      <Pressable onPress={() => setDialogVisible(true)} style={styles.thumbnailWrapper}>
        {uploading ? (
          <ActivityIndicator />
        ) : value ? (
          <Image source={{ uri: value }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons
              name="camera-plus-outline"
              size={28}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        )}
      </Pressable>
      <ErrorText style={styles.errorText}>{error}</ErrorText>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Add photo</Dialog.Title>
          <Dialog.Content>
            <Button
              mode="outlined"
              icon="camera"
              onPress={handleTakePhoto}
              style={styles.dialogButton}
            >
              Take Photo
            </Button>
            <Button
              mode="outlined"
              icon="image"
              onPress={handlePickFromLibrary}
              style={styles.dialogButton}
            >
              Choose from Library
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnailWrapper: {
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 12,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogButton: {
    marginBottom: 8,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8,
  },
});
