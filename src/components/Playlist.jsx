import React from 'react';
import '../App.css';

const Playlist = ({ playlist }) => {
    return (
        <div className="playlist-container">
            <h2>{playlist.message}</h2>
            <a
                href={playlist.playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="playlist-button"
            >
                <i className="fab fa-spotify"></i> Ouvir Playlist no Spotify
            </a>
        </div>
    );
};

export default Playlist;