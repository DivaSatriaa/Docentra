package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/DivaSatriaa/Docentra/backend/internal/config"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	dsn := "postgres://" +
		cfg.DBUser + ":" + cfg.DBPassword + "@" +
		cfg.DBHost + ":" + cfg.DBPort + "/" +
		cfg.DBName +
		"?sslmode=" + cfg.DBSSLMode

	m, err := migrate.New(
		"file://"+filepath.Join("migrations"),
		dsn,
	)
	if err != nil {
		log.Fatal(err)
	}

	defer func() {
		sourceErr, dbErr := m.Close()

		if sourceErr != nil {
			log.Printf("migration source close error: %v", sourceErr)
		}

		if dbErr != nil {
			log.Printf("migration database close error: %v", dbErr)
		}
	}()

	if len(os.Args) < 2 {
		log.Fatal("usage: go run ./cmd/migrate [up|down|version]")
	}

	switch os.Args[1] {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatal(err)
		}

		log.Println("migrations applied successfully")

	case "down":
		if err := m.Steps(-1); err != nil && err != migrate.ErrNoChange {
			log.Fatal(err)
		}

		log.Println("last migration rolled back successfully")

	case "version":
		version, dirty, err := m.Version()
		if err != nil {
			log.Fatal(err)
		}

		log.Printf("version=%d dirty=%v", version, dirty)

	default:
		log.Fatalf("unknown command: %s", os.Args[1])
	}
}
