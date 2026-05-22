# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 4.0.x   | ✅                 |
| 3.0.x   | ✅                 |
| < 3.0   | ❌                 |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability within Voice Note Studio, please send an email to muorongolejoshua@gmail.com. All security vulnerabilities will be promptly addressed.

## Security Best Practices

When self-hosting Voice Note Studio:

1. **Keep dependencies updated**: Regularly run `pip update` to get security patches
2. **Use environment variables**: Never hardcode secrets in your code
3. **Enable HTTPS**: Use a reverse proxy with SSL in production
4. **Set secure file permissions**: Restrict access to `uploads/` directory
5. **Regular backups**: Backup your `uploads/` directory and database

## Data Privacy

Voice Note Studio:
- Stores all data locally on your machine
- Does not send data to external servers
- Uses browser's local storage for preferences
- CDN resources are loaded from external servers

## Security Updates

Security updates will be released as patches for the latest major version.

## Contact

For security concerns: muorongolejoshua@gmail.com
