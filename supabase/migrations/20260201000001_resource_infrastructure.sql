-- ============================================================
-- UnstableLabs Resource Infrastructure Database Schema v1.0
-- Status: FOR_IMPORT
-- Date: February 1, 2026
-- Related: GD_SPEC_resource-infrastructure_v1_0.md
-- ============================================================

-- ============================================================
-- 1. BOOTSTRAP DEVICES
-- Tracks per-player cold start progress
-- ============================================================

CREATE TABLE IF NOT EXISTS bootstrap_state (
    player_id UUID PRIMARY KEY REFERENCES profiles(id),
    cold_start_phase INTEGER DEFAULT 0 
        CHECK (cold_start_phase BETWEEN 0 AND 5),
    -- Phase 0=discovery, 1=bootstrap, 2=ignition, 3=foundation, 4=expansion, 5=autonomy
    seep_collector_active BOOLEAN DEFAULT false,
    seep_collector_contents DECIMAL(18,6) DEFAULT 0,
    residual_cell_discharged BOOLEAN DEFAULT false,
    residual_cell_energy DECIMAL(18,6) DEFAULT 100,
    full_os_restored BOOLEAN DEFAULT false,
    cold_start_started_at TIMESTAMP,
    cold_start_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bootstrap_phase ON bootstrap_state(cold_start_phase);

-- ============================================================
-- 2. RESOURCE CONTAINERS
-- Every resource needs a container with capacity limits
-- ============================================================

CREATE TABLE IF NOT EXISTS resource_containers (
    container_id TEXT NOT NULL,
    player_id UUID NOT NULL REFERENCES profiles(id),
    resource_type TEXT NOT NULL,
    base_capacity INTEGER NOT NULL,
    upgrade_level INTEGER DEFAULT 0 
        CHECK (upgrade_level BETWEEN 0 AND 5),
    current_amount DECIMAL(18,6) DEFAULT 0 
        CHECK (current_amount >= 0),
    is_bootstrap BOOLEAN DEFAULT false,
    replaced_by TEXT,  -- container_id that replaced this one
    auto_created BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (container_id, player_id)
);

-- Capacity multiplier function
CREATE OR REPLACE FUNCTION calc_effective_capacity(
    base_cap INTEGER, 
    upgrade_lvl INTEGER
) RETURNS INTEGER AS $$
DECLARE
    multipliers INTEGER[] := ARRAY[1, 2, 3, 5, 8, 12];
BEGIN
    RETURN base_cap * multipliers[upgrade_lvl + 1];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Prevent overfill
CREATE OR REPLACE FUNCTION check_container_overflow()
RETURNS TRIGGER AS $$
DECLARE
    eff_cap INTEGER;
BEGIN
    eff_cap := calc_effective_capacity(NEW.base_capacity, NEW.upgrade_level);
    IF NEW.current_amount > eff_cap THEN
        NEW.current_amount := eff_cap;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_container_overflow
    BEFORE INSERT OR UPDATE ON resource_containers
    FOR EACH ROW EXECUTE FUNCTION check_container_overflow();

CREATE INDEX idx_containers_player ON resource_containers(player_id);
CREATE INDEX idx_containers_resource ON resource_containers(resource_type);

-- ============================================================
-- 3. CONTAINER DEFINITIONS
-- Master list of all container types
-- ============================================================

CREATE TABLE IF NOT EXISTS container_definitions (
    container_type_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    base_capacity INTEGER NOT NULL,
    tier INTEGER NOT NULL DEFAULT 0,
    is_bootstrap BOOLEAN DEFAULT false,
    replaces TEXT,  -- which bootstrap container it replaces
    auto_created_with TEXT,  -- device_id that auto-creates this
    upgrade_material TEXT,  -- what material upgrades cost
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO container_definitions VALUES
    -- Bootstrap containers (Tier 0)
    ('SPC-000', 'Seep Collector', 'abstractum', 500, 0, true, NULL, NULL, 'abstractum', 'Improvised Abstractum collector from exposed seep'),
    ('RSC-000', 'Residual Cell', 'energy', 100, 0, true, NULL, NULL, NULL, 'Emergency capacitor with residual charge'),
    -- Tier 1 containers
    ('ATK-001', 'Abstractum Tank', 'abstractum', 10000, 1, false, 'SPC-000', NULL, 'abstractum', 'Bulk Abstractum storage with purity preservation'),
    ('BAT-001', 'Battery Pack', 'energy', 5000, 1, false, 'RSC-000', NULL, 'power_cells', 'Portable energy storage and discharge'),
    ('BIN-101', 'Alloy Bin', 'base_alloy', 500, 1, false, NULL, 'SMT-001', 'base_alloy', 'Storage for refined Base Alloy'),
    ('VAT-102', 'Chemical Vat', 'basic_chemical', 500, 1, false, NULL, 'CHM-001', 'basic_chemical', 'Sealed storage for chemical compounds'),
    ('CRK-103', 'Cell Rack', 'power_cells', 200, 1, false, NULL, 'ENC-001', 'power_cells', 'Rack for organized Power Cell storage'),
    -- Tier 2 containers
    ('BIN-201', 'Alloy Vault', 'advanced_alloy', 1000, 2, false, NULL, 'ALF-001', 'base_alloy', 'Reinforced vault for Advanced Alloy'),
    ('ARY-202', 'Crystal Array', 'resonant_crystals', 200, 2, false, NULL, 'CRS-001', 'base_alloy', 'Resonance-dampened crystal storage'),
    ('SIL-203', 'Element Silo', 'rare_elements', 300, 2, false, NULL, 'EXP-001', 'abstractum', 'Climate-controlled element silo'),
    -- Tier 3 containers
    ('BIN-301', 'Nano-Container', 'nanomaterial', 500, 3, false, NULL, 'NFB-001', 'advanced_alloy', 'Molecular-sealed nanomaterial container'),
    ('EMC-302', 'Exotic Containment', 'exotic_matter', 200, 3, false, NULL, 'RRF-001', 'advanced_alloy', 'Quantum-stabilized exotic matter containment'),
    ('FLK-303', 'Antimatter Flask', 'antimatter', 50, 3, false, NULL, 'AMS-001', 'advanced_alloy', 'Magnetic confinement antimatter flask'),
    -- Tier 4 containers
    ('BIN-401', 'Quantum Vault', 'any_element', 300, 4, false, NULL, 'QTF-001', 'nanomaterial', 'Quantum-state element vault'),
    ('TUB-402', 'Memetic Reservoir', 'ideoplasm', 200, 4, false, NULL, 'MMF-001', 'nanomaterial', 'Thought-shielded memetic reservoir'),
    ('COR-403', 'Anomaly Cage', 'anomaly_cores', 20, 4, false, NULL, 'ANF-001', 'nanomaterial', 'Heavily shielded anomaly containment cage'),
    -- Tier 5 containers
    ('FRG-501', 'Stellar Vault', 'heavy_elements', 1000, 5, false, NULL, 'STF-001', 'exotic_matter', 'Stellar-grade heavy element vault'),
    ('SOL-502', 'Solvent Tank', 'universal_fixer', 50, 5, false, NULL, NULL, 'exotic_matter', 'Inert-lined universal solvent tank');

-- ============================================================
-- 4. PRODUCTION QUEUES
-- Tracks active and pending production jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS production_queue (
    queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES profiles(id),
    device_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    batch_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'active', 'paused', 'complete', 'cancelled')),
    started_at TIMESTAMP,
    completes_at TIMESTAMP,
    paused_at TIMESTAMP,
    pause_remaining_seconds INTEGER,
    inputs_consumed JSONB NOT NULL DEFAULT '{}',
    output_resource TEXT NOT NULL,
    output_container TEXT NOT NULL,
    output_amount DECIMAL(18,6) DEFAULT 1,
    energy_per_second DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_production_player ON production_queue(player_id);
CREATE INDEX idx_production_status ON production_queue(status);
CREATE INDEX idx_production_device ON production_queue(device_id);

-- ============================================================
-- 5. PRODUCTION RECIPES
-- Master recipe definitions for all production chains
-- ============================================================

CREATE TABLE IF NOT EXISTS production_recipes (
    recipe_id TEXT PRIMARY KEY,
    device_type TEXT NOT NULL,
    inputs JSONB NOT NULL,
    -- Example: {"abstractum": 40, "energy": 20}
    output_resource TEXT NOT NULL,
    output_amount DECIMAL(18,6) DEFAULT 1,
    production_time_seconds INTEGER NOT NULL,
    energy_draw DECIMAL(10,2) NOT NULL DEFAULT 0,
    -- E/s during production
    tier INTEGER NOT NULL,
    requires_science TEXT[],
    -- Array of science prerequisite IDs
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO production_recipes VALUES
    -- Tier 1 Refine
    ('recipe_base_alloy', 'smelter_unit', 
     '{"abstractum": 40, "energy": 20}', 'base_alloy', 1, 300, 8, 1,
     ARRAY['unstable_matter_theory'], 'Refine Abstractum into Base Alloy'),
    ('recipe_power_cells', 'energy_condenser',
     '{"abstractum": 30, "energy": 30}', 'power_cells', 1, 300, 6, 1,
     NULL, 'Condense energy into stable Power Cells'),
    ('recipe_basic_chemical', 'chemical_mixer',
     '{"abstractum": 35, "energy": 15}', 'basic_chemical', 1, 240, 5, 1,
     NULL, 'Extract chemicals from raw materials'),
    -- Tier 2 Refine
    ('recipe_advanced_alloy', 'alloy_forge',
     '{"base_alloy": 100, "energy": 50}', 'advanced_alloy', 1, 900, 12, 2,
     ARRAY['advanced_chemistry'], 'Forge Base Alloy into Advanced Alloy'),
    ('recipe_resonant_crystals', 'crystal_synthesizer',
     '{"base_alloy": 80, "energy": 80}', 'resonant_crystals', 1, 1200, 15, 2,
     ARRAY['aetheric_energy_theory'], 'Grow resonant data/energy crystals'),
    ('recipe_rare_elements', 'extractor_plant',
     '{"abstractum": 150, "energy": 60}', 'rare_elements', 1, 1200, 10, 2,
     NULL, 'Extract rare minerals from bulk Abstractum'),
    -- Tier 3 Refine
    ('recipe_nanomaterial', 'nanofabricator',
     '{"advanced_alloy": 200, "energy": 150}', 'nanomaterial', 1, 3600, 25, 3,
     ARRAY['neural_networks'], 'Molecular-level material assembly'),
    ('recipe_exotic_matter', 'resonance_refinery',
     '{"advanced_alloy": 180, "energy": 120}', 'exotic_matter', 1, 3600, 20, 3,
     ARRAY['resonance_physics'], 'Acoustic resonance purification'),
    ('recipe_antimatter', 'antimatter_synthesizer',
     '{"advanced_alloy": 100, "energy": 500}', 'antimatter', 1, 7200, 50, 3,
     ARRAY['quantum_mechanics'], 'High-energy antimatter synthesis'),
    -- Tier 4 Refine
    ('recipe_any_element', 'quantum_forge',
     '{"nanomaterial": 250, "energy": 600}', 'any_element', 1, 10800, 60, 4,
     ARRAY['unified_field_theory'], 'Quantum atomic rearrangement'),
    ('recipe_ideoplasm', 'memetic_fabricator',
     '{"nanomaterial": 220, "energy": 300}', 'ideoplasm', 1, 10800, 40, 4,
     ARRAY['memetics'], 'Convert memetic patterns to matter'),
    ('recipe_anomaly_cores', 'anomaly_forge',
     '{"nanomaterial": 200, "energy": 400}', 'anomaly_cores', 1, 14400, 50, 4,
     ARRAY['dimensional_theory'], 'Extract cores from captured anomalies'),
    -- Tier 5 Refine
    ('recipe_heavy_elements', 'stellar_forge',
     '{"exotic_matter": 500, "energy": 1000}', 'heavy_elements', 1, 28800, 100, 5,
     NULL, 'Stellar-condition heavy element production'),
    ('recipe_universal_fixer', 'universal_solvent',
     '{"exotic_matter": 300, "energy": 300}', 'universal_fixer', 1, 18000, 30, 5,
     NULL, 'Alchemical universal solvent creation'),
    ('recipe_transmutation', 'philosophers_stone',
     '{"anomaly_cores": 1, "energy": 1000}', 'transmutation', 1, 28800, 100, 5,
     NULL, 'True transmutation with minimal input');

-- ============================================================
-- 6. STARTER PACKS
-- ============================================================

CREATE TABLE IF NOT EXISTS starter_packs (
    pack_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_usd DECIMAL(6,2) NOT NULL,
    unsc_amount INTEGER NOT NULL,
    unsc_burned INTEGER NOT NULL,
    common_slices INTEGER DEFAULT 0,
    uncommon_slices INTEGER DEFAULT 0,
    bonus_items JSONB DEFAULT '[]',
    max_per_player INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO starter_packs VALUES
    ('spark_kit', 'Spark Kit', 5.00, 500, 500, 1, 0, '[]', 1, true, NOW()),
    ('ignition_kit', 'Ignition Kit', 7.50, 800, 800, 1, 1, '[]', 1, true, NOW()),
    ('genesis_kit', 'Genesis Kit', 10.00, 1200, 1200, 2, 1, 
     '[{"type":"cosmetic","id":"genesis_coat","name":"Genesis Coat"}]', 1, true, NOW());

CREATE TABLE IF NOT EXISTS pack_purchases (
    purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES profiles(id),
    pack_id TEXT NOT NULL REFERENCES starter_packs(pack_id),
    sol_amount DECIMAL(18,9),
    unsc_burned INTEGER NOT NULL,
    unsc_minted INTEGER NOT NULL,
    slices_minted JSONB NOT NULL DEFAULT '[]',
    bonus_items_granted JSONB DEFAULT '[]',
    tx_signature TEXT,
    purchased_at TIMESTAMP DEFAULT NOW()
);

-- One of each type per player
CREATE UNIQUE INDEX idx_one_pack_per_type 
    ON pack_purchases(player_id, pack_id);

-- ============================================================
-- 7. CONTAINER UPGRADE LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS container_upgrades (
    upgrade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES profiles(id),
    container_id TEXT NOT NULL,
    from_level INTEGER NOT NULL,
    to_level INTEGER NOT NULL,
    material_cost JSONB NOT NULL,
    unsc_cost INTEGER NOT NULL,
    upgraded_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 8. ABSTRACTUM GENERATION TRACKING
-- Tracks all sources of Abstractum income per player
-- ============================================================

CREATE TABLE IF NOT EXISTS abstractum_sources (
    source_id TEXT NOT NULL,
    player_id UUID NOT NULL REFERENCES profiles(id),
    source_type TEXT NOT NULL 
        CHECK (source_type IN ('seep', 'magnet', 'scanner', 'drone', 'swarm', 'excavator', 'forge', 'other')),
    rate_per_minute DECIMAL(18,6) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true,
    activated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (source_id, player_id)
);

-- ============================================================
-- 9. VIEWS
-- ============================================================

-- Player resource overview
CREATE OR REPLACE VIEW v_player_resources AS
SELECT 
    rc.player_id,
    rc.container_id,
    cd.name AS container_name,
    rc.resource_type,
    rc.current_amount,
    rc.base_capacity,
    rc.upgrade_level,
    calc_effective_capacity(rc.base_capacity, rc.upgrade_level) AS effective_capacity,
    ROUND(
        rc.current_amount::NUMERIC / 
        calc_effective_capacity(rc.base_capacity, rc.upgrade_level)::NUMERIC * 100, 1
    ) AS fill_percentage,
    cd.tier
FROM resource_containers rc
JOIN container_definitions cd ON rc.container_id = cd.container_type_id
ORDER BY cd.tier, rc.resource_type;

-- Active production summary
CREATE OR REPLACE VIEW v_active_production AS
SELECT
    pq.player_id,
    pq.device_id,
    pr.output_resource,
    pq.status,
    pq.started_at,
    pq.completes_at,
    EXTRACT(EPOCH FROM (pq.completes_at - NOW())) AS seconds_remaining,
    pq.energy_per_second
FROM production_queue pq
JOIN production_recipes pr ON pq.recipe_id = pr.recipe_id
WHERE pq.status IN ('active', 'pending')
ORDER BY pq.completes_at;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
