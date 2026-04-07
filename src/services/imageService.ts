
export const imageService = {
  /**
   * Uploads a base64 image to ImgBB (Free image hosting)
   * This is an alternative to Firebase Storage if it's not enabled.
   */
  async uploadToImgBB(base64Data: string): Promise<string> {
    try {
      const response = await fetch('/api/image/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Data }),
      });

      const result = await response.json();

      if (response.ok && result.url) {
        return result.url;
      } else {
        throw new Error(result.error || 'Failed to upload to ImgBB');
      }
    } catch (error) {
      console.error('ImgBB Upload Error:', error);
      throw error;
    }
  }
};
