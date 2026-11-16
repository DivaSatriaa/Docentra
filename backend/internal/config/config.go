package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	// AppHost is the address the API listens on. The default keeps it
	// reachable from this machine only: there is no authentication.
	AppHost string
	AppPort string
	AppEnv  string

	DBHost       string
	DBPort       string
	DBUser       string
	DBPassword   string
	DBName       string
	DBSSLMode    string
	AIServiceURL string
}

func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return &Config{
		AppHost: getEnv("APP_HOST", "127.0.0.1"),
		AppPort: getEnv("APP_PORT", "8080"),
		AppEnv:  getEnv("APP_ENV", "development"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "docentra"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "docentra"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		AIServiceURL: getEnv(
			"AI_SERVICE_URL",
			"http://localhost:8000",
		),
	}, nil

}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)

	if value == "" {
		return fallback
	}

	return value
}
