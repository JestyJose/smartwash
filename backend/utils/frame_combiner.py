import numpy as np


def combine_frames_mean(frames):
    """
    Merges multiple frames at pixel level using simple mean.
    """
    if not frames:
        return None
    
    stacked = np.array(frames, dtype=np.float32)
    return np.mean(stacked, axis=0).astype(np.uint8)


def combine_frames_weighted(frames, alpha=0.1):
    """
    Exponential Moving Average (EMA) across frames.
    F'_n = alpha*F_n + (1-alpha)*F'_{n-1}
    Latest frame gets more weight with exponential decay to older frames.
    """
    if not frames:
        return None
    
    n_frames = len(frames)
    weights = np.array([alpha * ((1 - alpha) ** (n_frames - 1 - i)) for i in range(n_frames)], dtype=np.float32)
    weights = weights / np.sum(weights)
    
    stacked = np.array(frames, dtype=np.float32)
    weights = weights.reshape(n_frames, 1, 1, 1)
    return np.sum(stacked * weights, axis=0).astype(np.uint8)


def combine_frames(frames, method='weighted', alpha=0.1):
    """
    Wrapper function to choose between averaging methods.
    """
    if method == 'mean':
        return combine_frames_mean(frames)
    return combine_frames_weighted(frames, alpha=alpha)
