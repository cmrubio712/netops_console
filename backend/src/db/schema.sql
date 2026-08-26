CREATE TABLE IF NOT EXISTS targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(512) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uptime_checks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_id INT NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  http_status INT,
  is_up BOOLEAN NOT NULL,
  dns_ms INT,
  connect_ms INT,
  tls_ms INT,
  ttfb_ms INT,
  total_ms INT,
  error VARCHAR(512),
  INDEX (target_id),
  INDEX (checked_at),
  FOREIGN KEY (target_id) REFERENCES targets(id)
);

CREATE TABLE IF NOT EXISTS ssl_certs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_id INT NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  issuer VARCHAR(255),
  not_before DATETIME,
  not_after DATETIME,
  days_remaining INT,
  protocol VARCHAR(32),
  cipher VARCHAR(128),
  INDEX (target_id),
  INDEX (checked_at),
  FOREIGN KEY (target_id) REFERENCES targets(id)
);

CREATE TABLE IF NOT EXISTS domain_whois (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_id INT NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  registrar VARCHAR(255),
  expires_at DATETIME,
  days_remaining INT,
  INDEX (target_id),
  INDEX (checked_at),
  FOREIGN KEY (target_id) REFERENCES targets(id)
);

CREATE TABLE IF NOT EXISTS security_headers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_id INT NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  hsts BOOLEAN NOT NULL DEFAULT FALSE,
  hsts_max_age INT,
  csp BOOLEAN NOT NULL DEFAULT FALSE,
  x_frame_options VARCHAR(64),
  x_content_type_options VARCHAR(64),
  referrer_policy VARCHAR(128),
  permissions_policy BOOLEAN NOT NULL DEFAULT FALSE,
  score INT,
  grade CHAR(1),
  INDEX (target_id),
  INDEX (checked_at),
  FOREIGN KEY (target_id) REFERENCES targets(id)
);

CREATE TABLE IF NOT EXISTS github_repos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS deployment_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  run_id BIGINT NOT NULL UNIQUE,
  workflow_name VARCHAR(255),
  status VARCHAR(32),
  conclusion VARCHAR(32),
  started_at DATETIME,
  duration_s INT,
  html_url VARCHAR(512),
  INDEX (repo_id),
  FOREIGN KEY (repo_id) REFERENCES github_repos(id)
);
