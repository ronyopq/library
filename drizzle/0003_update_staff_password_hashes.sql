UPDATE users
SET password_hash = 'pbkdf2$100000$P8qWyrQEE5j5XbVdRAcpIA==$eD0lg1MLk2KyRO9m2egzgyg0weR1iDxDABINoXuSvpM=',
    updated_at = CURRENT_TIMESTAMP
WHERE username_normalized = 'admin';

UPDATE users
SET password_hash = 'pbkdf2$100000$1kpGSKT26Oh6YRQhf4pJyA==$max/d7E8GeTQQXi5IaVGQIrmgmuzLpgr521+dRgC7BQ=',
    updated_at = CURRENT_TIMESTAMP
WHERE username_normalized = 'librarian';
