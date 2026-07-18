
-- Clean up existing tables if they exist (for fresh rebuild)
-- Clean up existing tables if they exist (for fresh rebuild)
DROP TABLE IF EXISTS promotion_transfer_history CASCADE;
DROP TABLE IF EXISTS position_assignments CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS cell_members CASCADE; -- Legacy table cleanup
DROP TABLE IF EXISTS cell_shepherds CASCADE; -- Legacy table cleanup
DROP TABLE IF EXISTS organizational_units CASCADE;
DROP TABLE IF EXISTS people CASCADE;

-- ============================================
-- 1. CORE TABLES
-- ============================================

-- People table (cleaned and deduplicated)
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID UNIQUE, -- Keep reference to original CSV ID
    full_name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    is_placeholder BOOLEAN DEFAULT false,
    CONSTRAINT chk_name_not_empty CHECK (full_name <> '')
);

-- Organizational Units (MCs, Buscentas, Cells)
CREATE TABLE organizational_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID UNIQUE, -- Keep reference to original CSV ID
    name VARCHAR(255) NOT NULL,
    unit_type VARCHAR(50) NOT NULL CHECK (unit_type IN ('ZONE', 'MC', 'BUSCENTA', 'CELL')),
    parent_id UUID REFERENCES organizational_units(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    is_placeholder BOOLEAN DEFAULT false,
    order_index INTEGER,
    CONSTRAINT chk_name_not_empty CHECK (name <> ''),
    CONSTRAINT chk_no_self_parent CHECK (id != parent_id)
);

-- Create index for hierarchical queries
CREATE INDEX idx_org_units_parent_id ON organizational_units(parent_id);
CREATE INDEX idx_org_units_type ON organizational_units(unit_type);

-- Positions/Roles table
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    unit_type VARCHAR(50) NOT NULL CHECK (unit_type IN ('MC', 'BUSCENTA', 'CELL', 'ZONE')),
    level INTEGER NOT NULL, -- 1=Zone, 2=MC, 3=Buscenta, 4=Cell, 5=Member
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_title_not_empty CHECK (title <> '')
);

-- Position Assignments (linking people to positions in units)
CREATE TABLE position_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES organizational_units(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT true,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT chk_valid_dates CHECK (end_date IS NULL OR end_date >= start_date),
    UNIQUE(person_id, position_id, unit_id, start_date)
);

-- Promotion and Transfer History
CREATE TABLE promotion_transfer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    from_assignment_id UUID REFERENCES position_assignments(id),
    to_assignment_id UUID REFERENCES position_assignments(id),
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('PROMOTION', 'TRANSFER', 'DEMOTION', 'APPOINTMENT', 'RESIGNATION')),
    change_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_by UUID REFERENCES people(id)
);

-- ============================================
-- 2. INSERT POSITIONS/ROLES
-- ============================================

DO $$
DECLARE
    zonal_head_id UUID := gen_random_uuid();
    mc_head_id UUID := gen_random_uuid();
    buscenta_head_id UUID := gen_random_uuid();
    cell_shepherd_id UUID := gen_random_uuid();
    shepherd_id UUID := gen_random_uuid();
    cell_member_id UUID := gen_random_uuid();
    first_timer_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO positions (id, title, description, unit_type, level) VALUES
    (zonal_head_id, 'Zonal Head', 'Overall zonal leadership', 'ZONE', 1),
    (mc_head_id, 'MC Head', 'Ministry Center Leader', 'MC', 2),
    (buscenta_head_id, 'Buscenta Head', 'Buscenta Leader', 'BUSCENTA', 3),
    (cell_shepherd_id, 'Cell Shepherd', 'Primary Cell Leader', 'CELL', 4),
    (shepherd_id, 'Shepherd', 'Associate/Co-Leader', 'CELL', 4),
    (cell_member_id, 'Cell Member', 'Regular Cell Member', 'CELL', 5),
    (first_timer_id, 'First Timer', 'First-time visitor registration role', 'CELL', 6);
END $$;

-- ============================================
-- 3. INSERT ORGANIZATIONAL UNITS
-- ============================================

-- Insert Zone (acts as parent for MCs)
INSERT INTO organizational_units (original_id, name, unit_type, parent_id, is_placeholder) VALUES
('03e6c6af-a128-4315-8bd2-02b100b9d474', 'Zone', 'ZONE', NULL, false);

DO $$
DECLARE
    zone_id UUID;
    soul_winners_id UUID;
    new_testament_id UUID;
    media_mc_id UUID;
    agape_mc_id UUID;
    dunamis_mc_id UUID;
BEGIN
    -- Get Zone ID
    SELECT id INTO zone_id FROM organizational_units WHERE name = 'Zone';
    
    -- Insert MCs
    -- Insert MCs
    INSERT INTO organizational_units (original_id, name, unit_type, parent_id, is_placeholder) VALUES
    ('eeae3d5a-087a-4635-b084-47cd7fc6b8f4', 'Soul Winners MC', 'MC', zone_id, true),
    (NULL, 'New Testament MC', 'MC', zone_id, false),
    (NULL, 'Media SM', 'MC', zone_id, true),
    (NULL, 'Agape MC', 'MC', zone_id, false),
    (NULL, 'Dunamis MC', 'MC', zone_id, true);

    -- Retrieve MC IDs
    SELECT id INTO soul_winners_id FROM organizational_units WHERE name = 'Soul Winners MC' LIMIT 1;
    SELECT id INTO new_testament_id FROM organizational_units WHERE name = 'New Testament MC' LIMIT 1;
    SELECT id INTO media_mc_id FROM organizational_units WHERE name = 'Media SM' LIMIT 1;
    SELECT id INTO agape_mc_id FROM organizational_units WHERE name = 'Agape MC' LIMIT 1;
    SELECT id INTO dunamis_mc_id FROM organizational_units WHERE name = 'Dunamis MC' LIMIT 1;
    
    -- Insert Buscentas
    INSERT INTO organizational_units (original_id, name, unit_type, parent_id, is_placeholder) VALUES
    -- Soul Winners MC Buscentas
    ('20d3a3a6-da0c-4832-9d40-b8c39ecc3070', 'New Breed Buscenta', 'BUSCENTA', soul_winners_id, true),
    ('fd275d76-10f7-46dd-ad3c-004f58336373', 'New Creation Buscenta', 'BUSCENTA', soul_winners_id, true),
    
    -- New Testament MC Buscentas
    (NULL, 'Kharis Buscenta 1', 'BUSCENTA', new_testament_id, false),
    (NULL, 'Kharis Buscenta 2', 'BUSCENTA', new_testament_id, false),
    
    -- Media MC Buscenta
    (NULL, 'Abundant Grace Buscenta', 'BUSCENTA', media_mc_id, true),
    
    -- Agape MC Buscentas
    (NULL, 'Joy Buscenta 1', 'BUSCENTA', agape_mc_id, false),
    (NULL, 'Joy Buscenta 2', 'BUSCENTA', agape_mc_id, false),
    
    -- Dunamis MC Buscentas
    (NULL, 'Grace Buscenta', 'BUSCENTA', dunamis_mc_id, true),
    (NULL, 'Fruit Bearers Buscenta', 'BUSCENTA', dunamis_mc_id, true),
    (NULL, 'Kharis Buscenta', 'BUSCENTA', dunamis_mc_id, true);
    
    -- Insert Cells under each Buscenta
    -- Get Buscenta IDs
    DECLARE
        new_breed_id UUID;
        new_creation_id UUID;
        kharis1_id UUID;
        kharis2_id UUID;
        abundant_grace_id UUID;
        joy1_id UUID;
        joy2_id UUID;
        grace_buscenta_id UUID;
        fruit_bearers_id UUID;
        dunamis_kharis_id UUID;
    BEGIN
        SELECT id INTO new_breed_id FROM organizational_units WHERE name = 'New Breed Buscenta';
        SELECT id INTO new_creation_id FROM organizational_units WHERE name = 'New Creation Buscenta';
        SELECT id INTO kharis1_id FROM organizational_units WHERE name = 'Kharis Buscenta 1';
        SELECT id INTO kharis2_id FROM organizational_units WHERE name = 'Kharis Buscenta 2';
        SELECT id INTO abundant_grace_id FROM organizational_units WHERE name = 'Abundant Grace Buscenta';
        SELECT id INTO joy1_id FROM organizational_units WHERE name = 'Joy Buscenta 1';
        SELECT id INTO joy2_id FROM organizational_units WHERE name = 'Joy Buscenta 2';
        SELECT id INTO grace_buscenta_id FROM organizational_units WHERE name = 'Grace Buscenta';
        SELECT id INTO fruit_bearers_id FROM organizational_units WHERE name = 'Fruit Bearers Buscenta';
        SELECT id INTO dunamis_kharis_id FROM organizational_units WHERE name = 'Kharis Buscenta' AND parent_id = dunamis_mc_id;
        
        -- Cells for New Breed Buscenta (2 cells)
        INSERT INTO organizational_units (original_id, name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('9fc9c679-fba5-400c-8dbb-8daf1ba77118', 'NBB Cell 1', 'CELL', new_breed_id, true, 1),
        ('40046068-5f0c-4ca4-9dc5-17593a8f7126', 'NBB Cell 2', 'CELL', new_breed_id, true, 2);
        
        -- Cells for New Creation Buscenta (3 cells)
        INSERT INTO organizational_units (original_id, name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('4573d516-c2cc-4271-80e7-d3796fb78862', 'NCB Cell 1', 'CELL', new_creation_id, true, 1),
        ('7376eccc-bfbf-4ff0-8e0c-98a167f6b9e2', 'NCB Cell 2', 'CELL', new_creation_id, true, 2),
        ('787b03b7-f07c-4ffb-9b56-388fe6d5c181', 'NCB Cell 3', 'CELL', new_creation_id, true, 3);
        
        -- Cells for Kharis Buscenta 1 (4 real cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('KB1 Cell 01', 'CELL', kharis1_id, false, 1),
        ('KB1 Cell 02', 'CELL', kharis1_id, false, 2),
        ('KB1 Cell 03', 'CELL', kharis1_id, false, 3),
        ('KB1 Cell 04', 'CELL', kharis1_id, false, 4);
        
        -- Cells for Kharis Buscenta 2 (5 real cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('KB2 Cell 01', 'CELL', kharis2_id, false, 1),
        ('KB2 Cell 02', 'CELL', kharis2_id, false, 2),
        ('KB2 Cell 03', 'CELL', kharis2_id, false, 3),
        ('KB2 Cell 04', 'CELL', kharis2_id, false, 4),
        ('KB2 Cell 05', 'CELL', kharis2_id, false, 5);
        
        -- Cells for Abundant Grace Buscenta (4 placeholder cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('AG Cell 01', 'CELL', abundant_grace_id, true, 1),
        ('AG Cell 02', 'CELL', abundant_grace_id, true, 2),
        ('AG Cell 03', 'CELL', abundant_grace_id, true, 3),
        ('AG Cell 04', 'CELL', abundant_grace_id, true, 4);
        
        -- Cells for Joy Buscenta 1 (3 real cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('JB1 Cell 01', 'CELL', joy1_id, false, 1),
        ('JB1 Cell 02', 'CELL', joy1_id, false, 2),
        ('JB1 Cell 03', 'CELL', joy1_id, false, 3);
        
        -- Cells for Joy Buscenta 2 (3 real cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('JB2 Cell 01', 'CELL', joy2_id, false, 1),
        ('JB2 Cell 02', 'CELL', joy2_id, false, 2),
        ('JB2 Cell 03', 'CELL', joy2_id, false, 3);
        
        -- Cells for Grace Buscenta (4 placeholder cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('GB Cell 01', 'CELL', grace_buscenta_id, true, 1),
        ('GB Cell 02', 'CELL', grace_buscenta_id, true, 2),
        ('GB Cell 03', 'CELL', grace_buscenta_id, true, 3),
        ('GB Cell 04', 'CELL', grace_buscenta_id, true, 4);
        
        -- Cells for Fruit Bearers Buscenta (4 placeholder cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('FBB Cell 01', 'CELL', fruit_bearers_id, true, 1),
        ('FBB Cell 02', 'CELL', fruit_bearers_id, true, 2),
        ('FBB Cell 03', 'CELL', fruit_bearers_id, true, 3),
        ('FBB Cell 04', 'CELL', fruit_bearers_id, true, 4);
        
        -- Cells for Dunamis Kharis Buscenta (4 placeholder cells)
        INSERT INTO organizational_units (name, unit_type, parent_id, is_placeholder, order_index) VALUES
        ('KB Cell 01', 'CELL', dunamis_kharis_id, true, 1),
        ('KB Cell 02', 'CELL', dunamis_kharis_id, true, 2),
        ('KB Cell 03', 'CELL', dunamis_kharis_id, true, 3),
        ('KB Cell 04', 'CELL', dunamis_kharis_id, true, 4);
    END;
END $$;

-- ============================================
-- 4. INSERT ALL PEOPLE (COMPLETE - 100+ PEOPLE)
-- ============================================

-- First, create a temporary table with ALL the raw CSV data
CREATE TEMPORARY TABLE raw_people_data (
    id UUID PRIMARY KEY,
    full_name VARCHAR,
    role TEXT,
    parent_id UUID,        -- Added this column
    photo_url TEXT,
    active BOOLEAN,
    is_placeholder BOOLEAN,
    original_role TEXT
);

-- Insert ALL 100+ people from the CSV with their original roles
INSERT INTO raw_people_data (id, full_name, parent_id, photo_url, active, is_placeholder, original_role) VALUES
    ('9920f040-1061-4c25-b8eb-6cad6cd3f5b3', 'Pastor Gloria Sekyere', '03e6c6af-a128-4315-8bd2-02b100b9d474', 'https://igoehhjfckmcpcqeediw.supabase.co/storage/v1/object/public/people-photos/aed2781c-2a2a-4c47-9a57-e8df6ec331d9.jpg', 'true', 'false', NULL),
    ('6ee7acfd-b791-4fff-a720-51e205c19552', 'Elder Beatrice Djagah', '03e6c6af-a128-4315-8bd2-02b100b9d474', 'https://igoehhjfckmcpcqeediw.supabase.co/storage/v1/object/public/people-photos/6ee7acfd-b791-4fff-a720-51e205c19552.jpg', 'true', 'false', 'New Testament MC Head'),
    ('4b019a2a-4870-44e8-b6a6-04291e429b58', 'Eugene Yaw Britwum', '03e6c6af-a128-4315-8bd2-02b100b9d474', 'https://igoehhjfckmcpcqeediw.supabase.co/storage/v1/object/public/people-photos/4b019a2a-4870-44e8-b6a6-04291e429b58.JPG', 'true', 'false', 'Media SM Head'),
    ('aed2781c-2a2a-4c47-9a57-e8df6ec331d9', 'Elder Beverly Mensah', '03e6c6af-a128-4315-8bd2-02b100b9d474', 'https://igoehhjfckmcpcqeediw.supabase.co/storage/v1/object/public/people-photos/aed2781c-2a2a-4c47-9a57-e8df6ec331d9.jpg', 'true', 'false', 'Agape MC Head'),
    ('124cb6e5-a42c-4575-91f1-07c42400b9d7', 'Pastor Albright Kankam', '03e6c6af-a128-4315-8bd2-02b100b9d474', 'https://igoehhjfckmcpcqeediw.supabase.co/storage/v1/object/public/people-photos/124cb6e5-a42c-4575-91f1-07c42400b9d7.jpg', 'true', 'false', 'Dunamis MC Head'),
    ('443c44a7-03f1-4d33-a41b-64cd755e9992', 'Marcellina Seshie', '0ecced05-bf28-403a-b657-137ca8c46a68', NULL, 'true', 'false', 'JB1 Cell Shepherd 01'),
    ('46a7be1b-614b-40c6-8fa8-3bf6d8ba4e7e', 'Prince Djangmah', '0ecced05-bf28-403a-b657-137ca8c46a68', NULL, 'true', 'false', 'JB1 Cell Shepherd 03'),
    ('d6a58d06-ae3c-4626-bc6c-de6dad6892a3', 'Josephine Apexi', '0ecced05-bf28-403a-b657-137ca8c46a68', NULL, 'true', 'false', 'JB1 Cell Shepherd 02'),
    ('0239abe8-c667-457e-914b-28346136a40e', 'Samuel Annor', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'Member of KB2 Cell 02'),
    ('8ec4228d-bf54-41ca-9cee-ced8d4a0b927', 'Hayford Opoku', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'Member of KB2 Cell 02'),
    ('cd03fcbe-e50c-4c96-95f5-bf982db7ee41', 'Stella', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'Member of KB2 Cell 02'),
    ('f4115992-f939-4985-804e-0d392a014593', 'Degraft', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'Member of KB2 Cell 02'),
    ('509c1977-298b-4dab-9302-b034aca62268', 'Philemon', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'Member of KB2 Cell 02'),
    ('72fe0d52-f755-42ff-aea7-b8dd0df58bf4', 'Isaac', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'Member of KB2 Cell 02'),
    ('81b6d76a-9b47-4945-83b1-3a40704067c8', 'Angel Osei', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'KB2 Cell 02 Shepherd'),
    ('fa0b3e2d-2b2a-40d8-ab9a-c696485f00d0', 'Emmanuel Boakye', '104d9e7d-6da9-414a-8786-1219a9095626', NULL, 'true', 'false', 'KB2 Cell 02 Shepherd'),
    ('9dbeee81-de63-4454-adca-c55ec45fef1d', 'Pending Identity', '1181ee33-10d6-4847-96e8-7430d6ac007e', NULL, 'true', 'true', 'FBB Cell 04 Shepherd'),
    ('dccd2745-5604-40ea-8c74-22cdc2ca23ad', 'Princess Ama Gyekye', '124cb6e5-a42c-4575-91f1-07c42400b9d7', NULL, 'true', 'false', 'Grace Buscenta Head'),
    ('9b87c8c4-4c50-461a-8c24-e66d87035c35', 'Kelvin Armah', '124cb6e5-a42c-4575-91f1-07c42400b9d7', NULL, 'true', 'false', 'Fruit Bearers Buscenta Head'),
    ('cc978906-f9ed-450e-9c84-a78e945960e7', 'Isaac Nuamah', '124cb6e5-a42c-4575-91f1-07c42400b9d7', NULL, 'true', 'false', 'Kharis Buscenta Head'),
    ('104d9e7d-6da9-414a-8786-1219a9095626', 'Jesse Asanab', '1a593388-842b-4db3-9510-4117966d4312', NULL, 'true', 'false', 'KB2 Cell Shepherd 02'),
    ('f2c00834-8323-4d91-b265-8c8d57f091c2', 'Samuel William Dodoo', '1a593388-842b-4db3-9510-4117966d4312', NULL, 'true', 'false', 'KB2 Cell Shepherd 01'),
    ('cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', 'Edwin Aveh', '1a593388-842b-4db3-9510-4117966d4312', NULL, 'true', 'false', 'KB2 Cell Shepherd 03'),
    ('66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', 'Beatrice Darkoa Baah', '1a593388-842b-4db3-9510-4117966d4312', NULL, 'true', 'false', 'KB2 Cell Shepherd 04'),
    ('4d23c227-69af-4cc0-a6ae-ff0e361444ee', 'Jeremiah Cofie', '1a593388-842b-4db3-9510-4117966d4312', NULL, 'true', 'false', 'KB2 Cell Shepherd 05'),
    ('9fc9c679-fba5-400c-8dbb-8daf1ba77118', 'NBB Cell 1', '20d3a3a6-da0c-4832-9d40-b8c39ecc3070', NULL, 'true', 'true', 'Cell'),
    ('40046068-5f0c-4ca4-9dc5-17593a8f7126', 'NBB Cell 2', '20d3a3a6-da0c-4832-9d40-b8c39ecc3070', NULL, 'true', 'true', 'Cell'),
    ('4fe517da-b97f-46c3-b2a2-cac702f452b9', 'Pending Identity', '8917bd80-1983-4f7c-8e8f-27a4bb2fe958', NULL, 'true', 'true', 'KB Cell 04 Shepherd'),
    ('7ab0aadc-5828-47a2-9768-e97cb0777346', 'Pending Identity', '272e3a1f-cb1f-4aa5-b52e-8b9679ef375e', NULL, 'true', 'true', 'NCB Cell 02 Shepherd'),
    ('781899ce-24ef-4df9-93e0-0135e4398281', 'Prince Aboagye', '272e3a1f-cb1f-4aa5-b52e-8b9679ef375e', NULL, 'true', 'false', 'NCB Cell 02 Shepherd'),
    ('fb24b74a-fd44-4ed1-a05f-f6a85aa86200', 'Pending Identity', '3ddcc2c1-26a6-43d1-8f1f-b62c81f861c4', NULL, 'true', 'true', 'KB Cell 01 Shepherd'),
    ('deb464a5-474a-43a0-bd3a-98a2d782a0d7', 'Pending Identity', '3f5ab0c9-c7af-4cb9-ad27-2c62cf5f7fcf', NULL, 'true', 'true', 'GB Cell 03 Shepherd'),
    ('5a85e6b3-99c4-43ca-9183-935e18c71dc5', 'Sarah York', '40046068-5f0c-4ca4-9dc5-17593a8f7126', NULL, 'true', 'false', 'NBB Cell Shepherd 02'),
    ('d47db766-7dff-409e-8872-794821255f49', 'Charity', '43e8b6f5-5976-4227-bb62-65dcb8e30c52', NULL, 'true', 'false', 'NBB Cell 01 Shepherd'),
    ('5ab39d7d-36a6-4812-aac7-bc5b1053851a', 'Pending Identity', '43e8b6f5-5976-4227-bb62-65dcb8e30c52', NULL, 'true', 'true', 'NBB Cell 01 Shepherd'),
    ('cf2e2971-22b9-487f-a1c5-0de6e82e927e', 'Pending Identity', '443c44a7-03f1-4d33-a41b-64cd755e9992', NULL, 'true', 'true', 'JB1 Cell 01 Shepherd'),
    ('7c0a3204-ad89-4ce1-b1ca-5c18a1daf4b4', '⁠Prince Smith', '443c44a7-03f1-4d33-a41b-64cd755e9992', NULL, 'true', 'false', 'JB1 Cell 01 Shepherd'),
    ('126eb274-1136-43d9-bb62-cb9e9991d251', 'Pending Identity', '452e08f6-8c10-4d3b-9f5c-9ccda74972cb', NULL, 'true', 'true', 'NCB Cell 03 Shepherd'),
    ('b750f9f0-2ab5-49df-9bc7-49f344bfd0dd', 'Epaphrase', '4573d516-c2cc-4271-80e7-d3796fb78862', NULL, 'true', 'false', 'NCB Cell Shepherd 01'),
    ('b2318ca4-79f9-4df1-903c-2815dbe89f3a', 'Clifford Ansu', '46a7be1b-614b-40c6-8fa8-3bf6d8ba4e7e', NULL, 'true', 'false', 'JB1 Cell 03 Shepherd'),
    ('bcdc27aa-c759-4a12-88b0-8f9571560c1b', 'Pending Identity', '46a7be1b-614b-40c6-8fa8-3bf6d8ba4e7e', NULL, 'true', 'true', 'JB1 Cell 03 Shepherd'),
    ('8771c058-f853-4863-96a7-9d6f82bc6e7b', 'Veronica Oppong', '4b019a2a-4870-44e8-b6a6-04291e429b58', 'https://igoehhjfckmcpcqeediw.supabase.co/storage/v1/object/public/people-photos/8771c058-f853-4863-96a7-9d6f82bc6e7b.JPG', 'true', 'false', 'Abundant Grace Buscenta Head'),
    ('02ee2603-e109-44bf-b080-c090bc66f76f', 'Nydia-Ann Ansabea Richardson', '4d23c227-69af-4cc0-a6ae-ff0e361444ee', NULL, 'true', 'false', 'KB2 Cell 05 Shepherd'),
    ('ab57eab8-9451-4947-b4fb-037b5315ffed', 'Joshua Boyefio', '4d23c227-69af-4cc0-a6ae-ff0e361444ee', NULL, 'true', 'false', 'KB2 Cell 05 Shepherd'),
    ('58beca34-931d-4f44-b032-53bd677fbb72', 'Kingsley Atsutse', '54db750a-0247-4a21-ad6d-23c75799f299', NULL, 'true', 'false', 'KB1 Cell Shepherd 01'),
    ('c1920ece-925f-4fca-af69-957484595e96', 'Sylvester Tonah-Peter', '54db750a-0247-4a21-ad6d-23c75799f299', NULL, 'true', 'false', 'KB1 Cell Shepherd 03'),
    ('e1512952-e2bf-49cd-9a07-7f1dfed65f59', 'Vivian Okoroji Adanna', '54db750a-0247-4a21-ad6d-23c75799f299', NULL, 'true', 'false', 'KB1 Cell Shepherd 04'),
    ('5e743331-2eb7-44e5-95ae-47c22778f41e', 'Nuhu Kofi Essuman', '54db750a-0247-4a21-ad6d-23c75799f299', NULL, 'true', 'false', 'KB1 Cell Shepherd 02'),
    ('556b97f0-af9c-42bd-87a2-0e0c5143911e', 'Eric Appah', '58beca34-931d-4f44-b032-53bd677fbb72', NULL, 'true', 'false', 'KB1 Cell 01 Shepherd'),
    ('f5122904-f4c4-4324-80b9-3e61c80ad7cb', 'Princess Serwaa Marfo', '58beca34-931d-4f44-b032-53bd677fbb72', NULL, 'true', 'false', 'KB1 Cell 01 Shepherd'),
    ('20f93c22-0336-4457-8028-65e221ca356f', 'Kaleb Asamoah Boateng', '58beca34-931d-4f44-b032-53bd677fbb72', NULL, 'true', 'false', 'Member of KB1 Cell 01'),
    ('7a47b7c3-4175-4318-852e-f920e99e5b52', 'Evans Owusu', '58beca34-931d-4f44-b032-53bd677fbb72', NULL, 'true', 'false', 'Member of KB1 Cell 01'),
    ('5bdd99cb-866d-4d60-ad06-254f0a87a86e', 'Samuel Annor', '58beca34-931d-4f44-b032-53bd677fbb72', NULL, 'true', 'false', 'Member of KB1 Cell 01'),
    ('f01900f3-04be-4f57-a19f-ebdad79e4aa9', 'Christabel Arthur', '58beca34-931d-4f44-b032-53bd677fbb72', NULL, 'true', 'false', 'Member of KB1 Cell 01'),
    ('c53b08b6-f8e9-434d-bc43-b89ec2922155', 'Georgette Baffour Awuah', '58beca34-931d-4f44-b032-53bd677fbb72', NULL, 'true', 'false', 'KB1 Cell 01 Shepherd'),
    ('ed368eaf-123d-4e7a-83f3-8408550da8f5', 'Pending Identity', '58df3e1f-4e47-48b5-a6eb-68409f55e3ab', NULL, 'true', 'true', 'GB Cell 04 Shepherd'),
    ('dabe8f46-8301-4243-850e-6cdb1b186e31', 'Emmanuel Twene Junior', '5a85e6b3-99c4-43ca-9183-935e18c71dc5', NULL, 'true', 'false', 'NBB Cell 02 Shepherd'),
    ('1c9b340d-2499-4d80-9523-549966fa815f', 'Pending Identity', '5a85e6b3-99c4-43ca-9183-935e18c71dc5', NULL, 'true', 'true', 'NBB Cell 02 Shepherd'),
    ('05d10ab1-3df2-4a76-ab9f-91b5b2f4d0c5', 'Anita Atiapah', '5e743331-2eb7-44e5-95ae-47c22778f41e', NULL, 'true', 'false', 'KB1 Cell 02 Shepherd'),
    ('8f8a84fa-e085-4f99-bdbd-1c9ddac6a729', 'Papa Yaw', '5e743331-2eb7-44e5-95ae-47c22778f41e', NULL, 'true', 'false', 'Member of KB1 Cell 02'),
    ('cdd5a250-4b9d-4f6a-bf37-60ef9e27589d', 'Delali Gamor', '5e743331-2eb7-44e5-95ae-47c22778f41e', NULL, 'true', 'false', 'Member of KB1 Cell 02'),
    ('cca37564-40fb-4432-98c3-7ae64988e0cd', 'Ivan Neequaye', '5e743331-2eb7-44e5-95ae-47c22778f41e', NULL, 'true', 'false', 'Member of KB1 Cell 02'),
    ('4d34005b-4c79-49fe-86e5-504c723bbadb', 'Oscar Ba-uu', '5e743331-2eb7-44e5-95ae-47c22778f41e', NULL, 'true', 'false', 'Member of KB1 Cell 02'),
    ('69d23938-eee9-4c9d-9b0d-9b5c9915455e', 'Michael Obi', '5e743331-2eb7-44e5-95ae-47c22778f41e', NULL, 'true', 'false', 'Member of KB1 Cell 02'),
    ('7aa3e322-7b8e-4ed0-8438-a3bf4a27056c', 'Elizabeth Owusu', '5e743331-2eb7-44e5-95ae-47c22778f41e', NULL, 'true', 'false', 'KB1 Cell 02 Shepherd'),
    ('830fbd19-f5a9-4187-bf77-95e73931d4dd', 'Pending Identity', '6556392c-11c0-4e5e-b89d-623e4e7900d1', NULL, 'true', 'true', 'KB Cell 02 Shepherd'),
    ('90f885f5-e362-4f70-be08-ab80dad0ae3e', 'Silas Asamoah Frimpong', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('ea3cdc16-0aac-433d-8bf0-284f45ff7f52', 'Maria Elsie Dodoo', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('e5bf2cc7-c240-4d77-b80a-5148829a14c5', 'Nana Akwesi Owusu-Sekyere', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('4cf9ff95-b277-4f01-af06-f28f61753585', 'Joseph Amoah', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('41656fa9-fd49-4b4d-94c2-a366a6d74f18', 'Elikplim Adonoo', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'KB2 Cell 04 Shepherd'),
    ('eeda406d-a061-4ce3-9b84-8c6fdeba5305', 'Aseda Maame Yaa Serwaa Addo', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'KB2 Cell 04 Shepherd'),
    ('2940516b-dcb5-4394-a715-69a2782de0f4', 'Aseda Asempa', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('15a7bd55-5d50-4f04-8c08-2ee9bd091333', 'Ransford Omari', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('f678b2d2-d4b6-4cd0-bab1-d9a25c1f800a', 'Raymond Tetteh', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('f4c21126-38a0-44ad-9604-b61f251e915d', 'Nhyira George', '66e4db95-eeaf-43e5-9cbf-e2df8be8e8a3', NULL, 'true', 'false', 'Member of KB2 Cell 04'),
    ('a157b3d1-dafb-4b81-ab40-35fed316439a', 'Pending Identity', '6e8af56f-4bad-4f43-8ec1-e51e9ad05227', NULL, 'true', 'true', 'FBB Cell 01 Shepherd'),
    ('1a593388-842b-4db3-9510-4117966d4312', 'Edh Obiri Yeboah', '6ee7acfd-b791-4fff-a720-51e205c19552', NULL, 'true', 'false', 'Kharis Buscenta 2 Head'),
    ('54db750a-0247-4a21-ad6d-23c75799f299', 'Flora Otoo', '6ee7acfd-b791-4fff-a720-51e205c19552', NULL, 'true', 'false', 'Kharis Buscenta 1 Head'),
    ('456c653e-5d94-4c2c-bccd-cae62fc2588d', 'Pending Identity', '729d71d9-99e8-4a9a-aaf1-17b145ab5692', NULL, 'true', 'true', 'GB Cell 02 Shepherd'),
    ('272e3a1f-cb1f-4aa5-b52e-8b9679ef375e', 'Sylvester Tonah Peter', '7376eccc-bfbf-4ff0-8e0c-98a167f6b9e2', NULL, 'true', 'false', 'NCB Cell Shepherd 02'),
    ('452e08f6-8c10-4d3b-9f5c-9ccda74972cb', 'Isaac Bechie', '787b03b7-f07c-4ffb-9b56-388fe6d5c181', NULL, 'true', 'false', 'NCB Cell Shepherd 03'),
    ('fbcf0d69-3e76-46cd-9020-d9252fc1d403', 'Harry Opare', '832e4f1c-9ec7-48e7-bb68-206584f54cb9', NULL, 'false', 'true', 'JB2 Cell 02 Shepherd'),
    ('af3aff74-392f-46d1-866f-49c88879ce3f', 'Nii Adjiri Parker', '832e4f1c-9ec7-48e7-bb68-206584f54cb9', NULL, 'true', 'false', 'JB2 Cell 02 Shepherd'),
    ('d6622b3a-6203-4ca0-8099-f4ae63a35566', 'Pending Identity', 'cc978906-f9ed-450e-9c84-a78e945960e7', NULL, 'true', 'true', 'KB Cell Shepherd 03'),
    ('6556392c-11c0-4e5e-b89d-623e4e7900d1', 'Pending Identity', 'cc978906-f9ed-450e-9c84-a78e945960e7', NULL, 'true', 'true', 'KB Cell Shepherd 02'),
    ('8917bd80-1983-4f7c-8e8f-27a4bb2fe958', 'Pending Identity', 'cc978906-f9ed-450e-9c84-a78e945960e7', NULL, 'true', 'true', 'KB Cell Shepherd 04'),
    ('3ddcc2c1-26a6-43d1-8f1f-b62c81f861c4', 'Pending Identity', 'cc978906-f9ed-450e-9c84-a78e945960e7', NULL, 'true', 'true', 'KB Cell Shepherd 01'),
    ('6cd663b1-3416-42ca-b022-6126bd329ee7', 'Pending Identity', '90720881-b047-4be1-8598-15147352e654', NULL, 'true', 'true', 'JB2 Cell 01 Shepherd'),
    ('ec67b449-8239-480f-8be9-c04bdd44e67d', 'Pending Identity', '9b87c8c4-4c50-461a-8c24-e66d87035c35', NULL, 'true', 'true', 'FBB Cell Shepherd 02'),
    ('6e8af56f-4bad-4f43-8ec1-e51e9ad05227', 'Pending Identity', '9b87c8c4-4c50-461a-8c24-e66d87035c35', NULL, 'true', 'true', 'FBB Cell Shepherd 01'),
    ('c8a693fd-d345-457a-bd64-00a132f1356a', 'Pending Identity', '9b87c8c4-4c50-461a-8c24-e66d87035c35', NULL, 'true', 'true', 'FBB Cell Shepherd 03'),
    ('1181ee33-10d6-4847-96e8-7430d6ac007e', 'Pending Identity', '9b87c8c4-4c50-461a-8c24-e66d87035c35', NULL, 'true', 'true', 'FBB Cell Shepherd 04'),
    ('1ea2b617-204e-4742-ae19-a29a09555b23', 'Kimberly E. Chimdi', '9c0b9d43-cb88-409e-9f95-742de1139ac6', NULL, 'true', 'false', 'JB2 Cell 03 Shepherd'),
    ('2a393cf5-2150-478a-a978-fcd3769fff93', 'Shammah Achufusi', '9c0b9d43-cb88-409e-9f95-742de1139ac6', NULL, 'true', 'false', 'JB2 Cell 03 Shepherd'),
    ('a16569bd-8318-47b3-915e-724f1769cf11', 'Charine Simons', '9c0b9d43-cb88-409e-9f95-742de1139ac6', NULL, 'true', 'false', 'JB2 Cell 03 Shepherd'),
    ('43e8b6f5-5976-4227-bb62-65dcb8e30c52', 'Joshua Vondee', '9fc9c679-fba5-400c-8dbb-8daf1ba77118', NULL, 'true', 'false', 'NBB Cell Shepherd 01'),
    ('0ecced05-bf28-403a-b657-137ca8c46a68', 'Caleb Yorke', 'aed2781c-2a2a-4c47-9a57-e8df6ec331d9', NULL, 'true', 'false', 'Joy Buscenta 1 Head'),
    ('dbcdd995-7097-44cb-a246-9a25de9c2b45', 'Regina Amedagbui', 'aed2781c-2a2a-4c47-9a57-e8df6ec331d9', NULL, 'true', 'false', 'Joy Buscenta 2 Head'),
    ('343c7057-998d-4ff2-b307-63866bb12d58', 'Pending Identity', 'b750f9f0-2ab5-49df-9bc7-49f344bfd0dd', NULL, 'true', 'true', 'NCB Cell 01 Shepherd'),
    ('77c53fd7-e037-491a-9be2-74c22262141e', 'Lucy', 'b750f9f0-2ab5-49df-9bc7-49f344bfd0dd', NULL, 'true', 'false', 'NCB Cell 01 Shepherd'),
    ('d5809fa2-4859-47ce-a2ec-8d4a80fa6bdd', 'Agnes Owusu', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 04'),
    ('72113bf3-0779-4779-b3b3-e84c47029547', 'Angela Adoma', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 03'),
    ('a5d5c0a2-6e73-4136-8fbe-055bca78311b', 'Joseph', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 03'),
    ('57c37652-6767-431a-bd92-9d0fdf14b45a', 'Sarah Yorke', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'false', 'false', 'KB1 Cell 03 Shepherd'),
    ('a61ccb61-cc10-4ba0-a84a-41870d91d744', 'Barbara Adoma', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 03'),
    ('de98c00f-218e-4a5e-970d-5a9ac86c1f6c', 'Enoch', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 03'),
    ('ed651ee4-a95b-4d8e-af25-dcea00228d3a', 'Alexander', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 04'),
    ('3514432c-e5d7-4526-a8ad-02adad313206', 'Bernard Prince', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 04'),
    ('e4e85130-3af9-42cc-b934-0ad1e9b9325b', 'Jermaine Karikari', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 04'),
    ('c204d68d-374f-4879-8bee-d7c097679553', 'Kofi Annor', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 04'),
    ('3773bafd-f688-4fa1-9f79-d79e2c3cf942', 'Joshua Asamani', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 04'),
    ('216c1d32-6d00-49c1-b966-a58bae366a13', 'Prince', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 03'),
    ('9ab090dc-c30a-4848-a24d-9cc7fc4a2bd0', 'Emmnauel', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'KB1 Cell 03 Shepherd'),
    ('7979dd2b-c382-4cd8-ac5e-f7046ea24cd1', 'Frimpong Charles', 'c1920ece-925f-4fca-af69-957484595e96', NULL, 'true', 'false', 'Member of KB1 Cell 03'),
    ('01db62d6-f257-4995-8049-35eda41f8f24', 'Pending Identity', 'c8a693fd-d345-457a-bd64-00a132f1356a', NULL, 'true', 'true', 'FBB Cell 03 Shepherd'),
    ('50aec67d-aac1-4d91-95a3-6c257f2319bd', 'Richmond Gyasi', '4d23c227-69af-4cc0-a6ae-ff0e361444ee', NULL, 'true', 'false', 'Member of KB2 Cell 05'),
    ('406b2d1f-789e-4a6f-9969-2cc4595d8d06', 'Reginald Mensa', '4d23c227-69af-4cc0-a6ae-ff0e361444ee', NULL, 'true', 'false', 'Member of KB2 Cell 05'),
    ('aba97b21-1c24-4420-baaa-ba262cd40f19', 'Isaac Yevu', '4d23c227-69af-4cc0-a6ae-ff0e361444ee', NULL, 'true', 'false', 'Member of KB2 Cell 05'),
    ('4fbb5110-dfdf-4a0d-a530-79f6036e9704', 'Pending Identity', 'cdee63e0-c0b0-4106-a6c3-48f2754f85c9', NULL, 'true', 'true', 'GB Cell 01 Shepherd'),
    ('0548d4c0-7a44-4418-a8b7-fb49cb4fa15a', 'David', 'cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', NULL, 'true', 'false', 'Member of KB2 Cell 03'),
    ('38af19e1-264c-4e90-b7c8-e36b064ecc21', 'Kobby Obeng', 'cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', NULL, 'true', 'false', 'Member of KB2 Cell 03'),
    ('d7e65e8e-7df0-4aff-b7e1-de20052dbf4b', 'Israel', 'cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', NULL, 'true', 'false', 'Member of KB2 Cell 03'),
    ('90b75c71-1c43-4f0c-ad55-840fea2045a7', 'Godfred', 'cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', NULL, 'true', 'false', 'Member of KB2 Cell 03'),
    ('64a814e8-248e-4c22-838c-f26d33791dca', 'Fred', 'cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', NULL, 'true', 'false', 'Member of KB2 Cell 03'),
    ('b6fe5d52-cf47-42a0-946b-e279ef47e5c1', 'Afryie Eno Adiepena', 'cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', NULL, 'true', 'false', 'KB2 Cell 03 Shepherd'),
    ('3c05da2b-a468-464c-9b96-3a314df64bdc', 'Derrick Edem', 'cf01cf31-477f-4e5f-af3a-b2f89fd90b6f', NULL, 'true', 'false', 'Member of KB2 Cell 03'),
    ('90aa0142-f389-4371-83d1-e948ee4312f1', 'Pending Identity', 'd6622b3a-6203-4ca0-8099-f4ae63a35566', NULL, 'true', 'true', 'KB Cell 03 Shepherd'),
    ('8d3ddb46-8c9a-4e82-9117-5181f51af976', 'Pending Identity', 'd6a58d06-ae3c-4626-bc6c-de6dad6892a3', NULL, 'true', 'true', 'JB1 Cell 02 Shepherd'),
    ('da3a2600-8458-49e9-ac41-c8eab5ef4087', 'Hope Ekpe', 'd6a58d06-ae3c-4626-bc6c-de6dad6892a3', NULL, 'true', 'false', 'JB1 Cell 02 Shepherd'),
    ('832e4f1c-9ec7-48e7-bb68-206584f54cb9', 'Emmanuella Ayerh', 'dbcdd995-7097-44cb-a246-9a25de9c2b45', NULL, 'true', 'false', 'JB2 Cell Shepherd 02'),
    ('9c0b9d43-cb88-409e-9f95-742de1139ac6', 'Stanley Addy', 'dbcdd995-7097-44cb-a246-9a25de9c2b45', NULL, 'true', 'false', 'JB2 Cell Shepherd 03'),
    ('90720881-b047-4be1-8598-15147352e654', 'Matilda Buah', 'dbcdd995-7097-44cb-a246-9a25de9c2b45', NULL, 'true', 'false', 'JB2 Cell Shepherd 01'),
    ('729d71d9-99e8-4a9a-aaf1-17b145ab5692', 'Pending Identity', 'dccd2745-5604-40ea-8c74-22cdc2ca23ad', NULL, 'true', 'true', 'GB Cell Shepherd 02'),
    ('3f5ab0c9-c7af-4cb9-ad27-2c62cf5f7fcf', 'Pending Identity', 'dccd2745-5604-40ea-8c74-22cdc2ca23ad', NULL, 'true', 'true', 'GB Cell Shepherd 03'),
    ('58df3e1f-4e47-48b5-a6eb-68409f55e3ab', 'Pending Identity', 'dccd2745-5604-40ea-8c74-22cdc2ca23ad', NULL, 'true', 'true', 'GB Cell Shepherd 04'),
    ('cdee63e0-c0b0-4106-a6c3-48f2754f85c9', 'Pending Identity', 'dccd2745-5604-40ea-8c74-22cdc2ca23ad', NULL, 'true', 'true', 'GB Cell Shepherd 01'),
    ('a38fc8f6-3c88-4879-b49c-29cfdfa31989', 'Margaret Owusu', 'e1512952-e2bf-49cd-9a07-7f1dfed65f59', NULL, 'true', 'false', 'KB1 Cell 04 Shepherd'),
    ('33239f4e-9b1e-4279-9a33-1d7a7de6f176', 'Caleb Adjei Asante', 'e1512952-e2bf-49cd-9a07-7f1dfed65f59', NULL, 'true', 'false', 'KB1 Cell 04 Shepherd'),
    ('8df1c054-f2fc-4e6e-858a-c2197c722f67', 'Pending Identity', 'ec67b449-8239-480f-8be9-c04bdd44e67d', NULL, 'true', 'true', 'FBB Cell 02 Shepherd'),
    ('20d3a3a6-da0c-4832-9d40-b8c39ecc3070', 'New Breed Buscenta', 'eeae3d5a-087a-4635-b084-47cd7fc6b8f4', NULL, 'true', 'true', 'Buscenta 1'),
    ('fd275d76-10f7-46dd-ad3c-004f58336373', 'New Creation Buscenta', 'eeae3d5a-087a-4635-b084-47cd7fc6b8f4', NULL, 'true', 'true', 'Buscenta 2'),
    ('670cfb00-c794-4103-90bc-4362b00f1e7c', 'Peter Kekeli Dotse', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('6c181184-65c6-4b2d-8814-d72dd0c7fd35', 'Kelvin Boakye', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('58881eba-416b-4e47-86b1-d6930a4ab770', 'Christabel Larbi', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('9007d4d7-fb8f-4a01-91bd-4f2cf7236f99', 'Priscilla Kissiwaa Amponsah', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('372e0fea-6236-4eee-ab92-08f5a56536ec', 'Eyram Agboli', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'KB2 Cell 01 Shepherd'),
    ('874717a5-93e0-4bf4-a2ee-cf89a15e3625', 'Sarah Acquah', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'KB2 Cell 01 Shepherd'),
    ('60d43310-34eb-444e-beb5-f765f6d72769', 'Yvette Dovlo', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('bcc5e5da-5339-474b-942a-d00f1424076e', 'Noelle Ewurasi Sika Antwi', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('42a01bab-bddc-41e9-9e64-f342785c2d73', 'Nana Kwadwo Adu Bempong', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('381e20b7-6f06-4f70-be14-475024fb7e1a', 'Pascal Adjei', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('5c832475-4625-45ce-ad21-baddd8fb0df6', 'Ewurabena Mensah', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('15d5df65-fb00-48c1-a96b-983a082beae9', 'Kwabena Ofosu', 'f2c00834-8323-4d91-b265-8c8d57f091c2', NULL, 'true', 'false', 'Member of KB2 Cell 01'),
    ('4573d516-c2cc-4271-80e7-d3796fb78862', 'NCB Cell 1', 'fd275d76-10f7-46dd-ad3c-004f58336373', NULL, 'true', 'true', 'Cell'),
    ('7376eccc-bfbf-4ff0-8e0c-98a167f6b9e2', 'NCB Cell 2', 'fd275d76-10f7-46dd-ad3c-004f58336373', NULL, 'true', 'true', 'Cell'),
    ('787b03b7-f07c-4ffb-9b56-388fe6d5c181', 'NCB Cell 3', 'fd275d76-10f7-46dd-ad3c-004f58336373', NULL, 'true', 'true', 'Cell'),
    ('03e6c6af-a128-4315-8bd2-02b100b9d474', 'Rev. Giorgio Mensah', NULL, 'https://igoehhjfckmcpcqeediw.supabase.co/storage/v1/object/public/people-photos/03e6c6af-a128-4315-8bd2-02b100b9d474.jpg', 'true', 'false', 'Zonal Head'),
    ('eeae3d5a-087a-4635-b084-47cd7fc6b8f4', 'Soul Winners MC', NULL, NULL, 'true', 'true', 'MC');


-- Now clean, deduplicate, and insert into the main people table
WITH cleaned_data AS (
    SELECT 
        id as original_id,
        CASE 
            WHEN TRIM(BOTH ' ' FROM full_name) = 'Pending Identity' THEN 'Pending Identity'
            ELSE TRIM(BOTH ' ' FROM REGEXP_REPLACE(REGEXP_REPLACE(full_name, '\s+', ' ', 'g'), '[[:cntrl:]]', '', 'g'))
        END as clean_name,
        photo_url,
        NOW() as created_at,
        active,
        is_placeholder,
        original_role,
        ROW_NUMBER() OVER (
            PARTITION BY id
            ORDER BY 
                active DESC,  -- Active first

                CASE WHEN photo_url IS NOT NULL THEN 1 ELSE 0 END DESC  -- With photo first
        ) as rn
    FROM raw_people_data
    WHERE active = true  -- Only include active people
    AND TRIM(BOTH ' ' FROM full_name) != ''  -- Exclude empty names
)
INSERT INTO people (original_id, full_name, photo_url, created_at, is_active, is_placeholder)
SELECT 
    original_id,
    clean_name,
    photo_url,
    created_at,
    true,  -- All inserted are active
    is_placeholder
FROM cleaned_data
WHERE rn = 1;  -- Only keep the first (most relevant) entry for each person

-- Drop the temporary table
-- TEMPORARILY KEEP raw_people_data for assignment logic
-- DROP TABLE raw_people_data;

-- Display insertion results
DO $$
DECLARE
    total_people INT;
    real_people INT;
    placeholder_people INT;
BEGIN
    SELECT COUNT(*) INTO total_people FROM people;
    SELECT COUNT(*) INTO real_people FROM people WHERE is_placeholder = false;
    SELECT COUNT(*) INTO placeholder_people FROM people WHERE is_placeholder = true;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'PEOPLE INSERTION COMPLETE';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total people inserted: %', total_people;
    RAISE NOTICE 'Real people: %', real_people;
    RAISE NOTICE 'Placeholder people: %', placeholder_people;
    RAISE NOTICE '===========================================';
END $$;

-- ============================================
-- 5. CREATE POSITION ASSIGNMENTS (DYNAMIC MAPPING)
-- ============================================

DO $$
DECLARE
    assignment_count INT := 0;
    r RECORD;
    v_position_id UUID;
    v_unit_id UUID;
    v_person_id UUID;
    v_unit_name TEXT;
    v_position_title TEXT;
    v_role_clean TEXT;
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STARTING DYNAMIC POSITION ASSIGNMENTS';
    RAISE NOTICE '===========================================';

    -- Loop through all people who have an original_role from the CSV
    -- We access original_role from the raw_people_data temp table which we preserved
    
    FOR r IN 
        SELECT p.id as person_id, p.full_name, rd.original_role
        FROM people p
        JOIN raw_people_data rd ON p.original_id = rd.id
        WHERE rd.original_role IS NOT NULL AND rd.original_role != ''
    LOOP
        v_role_clean := TRIM(BOTH ' ' FROM r.original_role);
        v_unit_id := NULL;
        v_position_id := NULL;
        v_unit_name := NULL;
        
        -- ---------------------------------------------------------
        -- LOGIC TO DETERMINE UNIT AND POSITION FROM ROLE STRING
        -- ---------------------------------------------------------
        
        -- PRE-PROCESSING: Normalize "SM" to "MC" for Heads
        -- Disabled for Media SM compatibility
        IF v_role_clean ~* ' SM Head$' AND v_role_clean NOT ILIKE 'Media SM Head' THEN
            v_role_clean := REGEXP_REPLACE(v_role_clean, ' SM Head$', ' MC Head', 'i');
        END IF;

        -- CASE 1: "[Unit Name] Head"
        IF v_role_clean ~* ' Head$' THEN
             v_unit_name := REGEXP_REPLACE(v_role_clean, ' Head$', '', 'i');
             
             SELECT id INTO v_unit_id FROM organizational_units WHERE name = v_unit_name LIMIT 1;
             
             IF v_unit_id IS NOT NULL THEN
                 SELECT title INTO v_position_title FROM positions 
                 WHERE unit_type = (SELECT unit_type FROM organizational_units WHERE id = v_unit_id)
                 AND title LIKE '%Head'
                 LIMIT 1;
             ELSE
                 IF v_role_clean = 'Zonal Head' THEN
                     SELECT id INTO v_unit_id FROM organizational_units WHERE name = 'Zone' LIMIT 1;
                     v_position_title := 'Zonal Head';
                 END IF;
             END IF;

        -- CASE 2: Shepherd (Cell)
        ELSIF v_role_clean ~* 'Shepherd' THEN
            -- Determine Role based on pattern
            -- "KB2 Cell Shepherd 02" (Shepherd followed by number) -> Cell Shepherd (Primary)
            -- "KB2 Cell 02 Shepherd" (Ends with Shepherd) -> Shepherd (Associate)
            IF v_role_clean ~* 'Shepherd\s+[0-9]+$' THEN
                v_position_title := 'Cell Shepherd'; 
            ELSE
                v_position_title := 'Shepherd';
            END IF;
            
            -- STRATEGY 1: Exact containment (e.g. "KB2 Cell 02 Shepherd" contains "KB2 Cell 02")
            SELECT id, name INTO v_unit_id, v_unit_name 
            FROM organizational_units 
            WHERE unit_type = 'CELL' 
            AND v_role_clean LIKE '%' || name || '%'
            ORDER BY LENGTH(name) DESC 
            LIMIT 1;

            -- STRATEGY 2: Remove "Shepherd" and check for exact Unit Name match
            IF v_unit_id IS NULL THEN
                DECLARE 
                    v_try_name TEXT;
                BEGIN
                    v_try_name := REGEXP_REPLACE(v_role_clean, ' Shepherd', '', 'i'); -- Remove suffix
                    v_try_name := REGEXP_REPLACE(v_try_name, 'Shepherd ', '', 'i'); -- Remove prefix
                    v_try_name := TRIM(BOTH ' ' FROM v_try_name); -- Trim
                    v_try_name := REGEXP_REPLACE(v_try_name, '\s+', ' ', 'g'); -- Normalize spaces
                    
                    SELECT id, name INTO v_unit_id, v_unit_name 
                    FROM organizational_units 
                    WHERE unit_type = 'CELL' 
                    AND name = v_try_name
                    LIMIT 1;
                END;
            END IF;

             -- If found, check Assistant overrides
            IF v_unit_id IS NOT NULL THEN
                 -- Map explicit "Assistant" roles to the Associate title
                 IF v_role_clean ~* 'Assistant' OR v_role_clean ~* 'Asst' THEN
                     v_position_title := 'Shepherd';
                 END IF;
            END IF;

        -- CASE 3: "Member of [Unit Name]"
        ELSIF v_role_clean ~* '^Member of ' THEN
            v_unit_name := SUBSTRING(v_role_clean FROM 11); 
            v_position_title := 'Cell Member';
            SELECT id INTO v_unit_id FROM organizational_units WHERE name = TRIM(v_unit_name) LIMIT 1;
        
        ELSIF v_role_clean = 'Cell' THEN
             CONTINUE; 

        END IF;

        -- ---------------------------------------------------------
        -- EXECUTE ASSIGNMENT
        -- ---------------------------------------------------------
        IF v_unit_id IS NOT NULL THEN
            SELECT id INTO v_position_id FROM positions WHERE title = v_position_title LIMIT 1;
            
            IF v_position_id IS NOT NULL THEN
                INSERT INTO position_assignments (person_id, position_id, unit_id, is_primary, start_date, is_active)
                VALUES (r.person_id, v_position_id, v_unit_id, true, CURRENT_DATE, true)
                ON CONFLICT DO NOTHING;
                
                assignment_count := assignment_count + 1;
                -- RAISE NOTICE 'Assigned: % -> % in %', r.full_name, v_position_title, v_unit_name;
            ELSE
                RAISE NOTICE 'WARNING: Position not found for role "%" (Mapped to title "%")', v_role_clean, v_position_title;
            END IF;
        ELSE
             -- Fallback: If no strict unit text match, maybe it IS the unit name?
             -- e.g. Role: "KB2 Cell 04".
             -- If so, what position? Member?
             -- Skipping vague roles.
             -- RAISE NOTICE 'Skipping vague role: %', v_role_clean;
        END IF;
        
    END LOOP;

    -- =========================================================
    -- HIERARCHY RECONSTRUCTION (Use CSV parent_id to link Units)
    -- =========================================================
    RAISE NOTICE 'Starting Hierarchy Reconstruction...';
    
    DECLARE
        v_parent_csv_id UUID;
        v_child_unit_id UUID;
        v_parent_unit_id UUID;
        v_update_count INT := 0;
    BEGIN
        FOR r IN 
            SELECT rd.id as csv_id, rd.parent_id as parent_csv_id
            FROM raw_people_data rd
            WHERE rd.parent_id IS NOT NULL
        LOOP
            -- 1. Identify Child Unit (Where this person is a Leader)
            SELECT pa.unit_id INTO v_child_unit_id
            FROM position_assignments pa
            JOIN people p ON pa.person_id = p.id
            JOIN positions pos ON pa.position_id = pos.id
            WHERE p.original_id = r.csv_id
            AND (pos.title ILIKE '%Head' OR pos.title ILIKE '%Shepherd')
            LIMIT 1;

            -- 2. Identify Parent Unit (Where parent person is a Leader)
            SELECT pa.unit_id INTO v_parent_unit_id
            FROM position_assignments pa
            JOIN people p ON pa.person_id = p.id
            JOIN positions pos ON pa.position_id = pos.id
            WHERE p.original_id = r.parent_csv_id
            AND (pos.title ILIKE '%Head' OR pos.title ILIKE '%Shepherd')
            LIMIT 1;

            -- 3. Link them if found
            IF v_child_unit_id IS NOT NULL AND v_parent_unit_id IS NOT NULL AND v_child_unit_id != v_parent_unit_id THEN
                UPDATE organizational_units
                SET parent_id = v_parent_unit_id
                WHERE id = v_child_unit_id;
                
                IF FOUND THEN
                    v_update_count := v_update_count + 1;
                END IF;
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Updated % units via hierarchy reconstruction', v_update_count;
    END;
    
    -- Drop the temp table now that we are done
    DROP TABLE raw_people_data;

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'DYNAMIC ASSIGNMENTS COMPLETE';
    RAISE NOTICE 'Total assignments made: %', assignment_count;
    RAISE NOTICE '===========================================';
END $$;

-- ============================================
-- 6. CREATE VIEWS FOR EASY QUERYING
-- ============================================

-- View for complete organizational hierarchy
CREATE OR REPLACE VIEW organizational_hierarchy AS
WITH RECURSIVE org_tree AS (
    SELECT 
        id,
        name,
        unit_type,
        parent_id,
        is_placeholder,
        1 as level,
        name::TEXT as path
    FROM organizational_units
    WHERE parent_id IS NULL
    
    UNION ALL
    
    SELECT 
        ou.id,
        ou.name,
        ou.unit_type,
        ou.parent_id,
        ou.is_placeholder,
        ot.level + 1,
        ot.path || ' â†’ ' || ou.name
    FROM organizational_units ou
    JOIN org_tree ot ON ou.parent_id = ot.id
)
SELECT * FROM org_tree ORDER BY path;

-- View for people with their positions
CREATE OR REPLACE VIEW people_positions AS
SELECT 
    p.full_name,
    p.is_placeholder as person_placeholder,
    pos.title as position,
    ou.name as unit_name,
    ou.unit_type,
    pa.is_primary,
    pa.start_date,
    pa.end_date,
    pa.is_active as assignment_active
FROM people p
JOIN position_assignments pa ON p.id = pa.person_id
JOIN positions pos ON pa.position_id = pos.id
JOIN organizational_units ou ON pa.unit_id = ou.id
WHERE p.is_active = true
ORDER BY pos.level, p.full_name;

-- View for MC summary
CREATE OR REPLACE VIEW mc_summary AS
SELECT 
    mc.name as mc_name,
    COUNT(DISTINCT b.id) as buscenta_count,
    COUNT(DISTINCT c.id) as cell_count,
    COUNT(DISTINCT CASE WHEN p.is_placeholder = false THEN pa.person_id END) as real_people_count,
    COUNT(DISTINCT CASE WHEN p.is_placeholder = true THEN pa.person_id END) as placeholder_people_count,
    mc.is_placeholder as mc_is_placeholder
FROM organizational_units mc
LEFT JOIN organizational_units b ON b.parent_id = mc.id AND b.unit_type = 'BUSCENTA'
LEFT JOIN organizational_units c ON c.parent_id = b.id AND c.unit_type = 'CELL'
LEFT JOIN position_assignments pa ON pa.unit_id IN (mc.id, b.id, c.id)
LEFT JOIN people p ON pa.person_id = p.id
WHERE mc.unit_type = 'MC'
GROUP BY mc.id, mc.name, mc.is_placeholder
ORDER BY mc.name;

-- ============================================
-- 7. CREATE FUNCTIONS FOR PROMOTIONS/TRANSFERS
-- ============================================

-- Function to promote/transfer a person
CREATE OR REPLACE FUNCTION promote_transfer_person(
    person_id UUID,
    new_position_title VARCHAR,
    new_unit_name VARCHAR,
    change_type VARCHAR,
    reason TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    recorded_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    new_position_id UUID;
    new_unit_id UUID;
    current_assignment_id UUID;
    new_assignment_id UUID;
    history_id UUID;
BEGIN
    -- Get new position and unit
    SELECT id INTO new_position_id FROM positions WHERE title = new_position_title LIMIT 1;
    SELECT id INTO new_unit_id FROM organizational_units WHERE name = new_unit_name AND is_active = true LIMIT 1;
    
    -- Identify the most relevant current assignment to link in history (e.g., the primary one or most recent)
    SELECT id INTO current_assignment_id
    FROM position_assignments
    WHERE person_id = promote_transfer_person.person_id 
    AND is_active = true
    ORDER BY is_primary DESC, start_date DESC
    LIMIT 1;

    -- End ALL current active assignments for this person (assuming a clean slate for the new role)
    -- If you wanted to keep some roles, you'd need more specific logic.
    UPDATE position_assignments 
    SET end_date = CURRENT_DATE, is_active = false, updated_at = NOW()
    WHERE person_id = promote_transfer_person.person_id 
    AND is_active = true;
    
    -- Create new assignment
    INSERT INTO position_assignments 
        (person_id, position_id, unit_id, start_date, is_active)
    VALUES 
        (person_id, new_position_id, new_unit_id, CURRENT_DATE, true)
    RETURNING id INTO new_assignment_id;
    
    -- Record in history
    INSERT INTO promotion_transfer_history 
        (person_id, from_assignment_id, to_assignment_id, change_type, reason, notes, recorded_by)
    VALUES 
        (person_id, current_assignment_id, new_assignment_id, change_type, reason, notes, recorded_by)
    RETURNING id INTO history_id;
    
    RETURN history_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get a person's assignment history
CREATE OR REPLACE FUNCTION get_person_history(person_uuid UUID)
RETURNS TABLE (
    change_date DATE,
    change_type VARCHAR,
    from_position VARCHAR,
    from_unit VARCHAR,
    to_position VARCHAR,
    to_unit VARCHAR,
    reason TEXT,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.change_date,
        h.change_type,
        fp.title as from_position,
        fu.name as from_unit,
        tp.title as to_position,
        tu.name as to_unit,
        h.reason,
        h.notes
    FROM promotion_transfer_history h
    LEFT JOIN position_assignments fa ON h.from_assignment_id = fa.id
    LEFT JOIN position_assignments ta ON h.to_assignment_id = ta.id
    LEFT JOIN positions fp ON fa.position_id = fp.id
    LEFT JOIN positions tp ON ta.position_id = tp.id
    LEFT JOIN organizational_units fu ON fa.unit_id = fu.id
    LEFT JOIN organizational_units tu ON ta.unit_id = tu.id
    WHERE h.person_id = person_uuid
    ORDER BY h.change_date DESC, h.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. VALIDATION AND REPORTING QUERIES
-- ============================================

-- Create a comprehensive validation report
CREATE OR REPLACE VIEW database_validation_report AS
WITH org_stats AS (
SELECT 
        'Organizational Units'::TEXT as category,
        unit_type::TEXT as item,
        COUNT(*)::BIGINT as count,
        COUNT(CASE WHEN is_placeholder = true THEN 1 END)::BIGINT as placeholders
    FROM organizational_units 
    GROUP BY unit_type
),
people_stats AS (
    SELECT 
        'People'::TEXT as category,
        'Total People'::TEXT as item,
        COUNT(*)::BIGINT as count,
        COUNT(CASE WHEN is_placeholder = true THEN 1 END)::BIGINT as placeholders
    FROM people
),
assignment_stats AS (
    SELECT 
        'Assignments'::TEXT as category,
        p.title::TEXT as item,
        COUNT(pa.id)::BIGINT as count,
        COUNT(DISTINCT pa.unit_id)::BIGINT as units_covered
    FROM positions p
    LEFT JOIN position_assignments pa ON p.id = pa.position_id AND pa.is_active = true
    GROUP BY p.id, p.title, p.level
    ORDER BY p.level
),
leaderless_units AS (
    SELECT 
        'Leaderless Units'::TEXT as category,
        ou.name::TEXT as item,
        1::BIGINT as count,
        0::BIGINT as placeholders
    FROM organizational_units ou
    LEFT JOIN position_assignments pa ON ou.id = pa.unit_id AND pa.is_active = true
    LEFT JOIN positions pos ON pa.position_id = pos.id AND pos.level IN (2,3,4)
    WHERE pa.id IS NULL
    AND ou.unit_type IN ('MC', 'BUSCENTA', 'CELL')
    AND ou.is_placeholder = false
)
SELECT * FROM org_stats
UNION ALL SELECT * FROM people_stats
UNION ALL SELECT * FROM assignment_stats
UNION ALL SELECT * FROM leaderless_units;

-- ============================================
-- 9. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_people_name ON people(full_name);
CREATE INDEX idx_people_active ON people(is_active) WHERE is_active = true;
CREATE INDEX idx_position_assignments_active ON position_assignments(is_active) WHERE is_active = true;
CREATE INDEX idx_position_assignments_person ON position_assignments(person_id);
CREATE INDEX idx_position_assignments_unit ON position_assignments(unit_id);
CREATE INDEX idx_org_units_active ON organizational_units(is_active) WHERE is_active = true;
CREATE INDEX idx_promotion_history_person ON promotion_transfer_history(person_id);
CREATE INDEX idx_promotion_history_date ON promotion_transfer_history(change_date);
CREATE INDEX idx_people_original_id ON people(original_id);
CREATE INDEX idx_org_units_original_id ON organizational_units(original_id);

-- ============================================
-- 10. CREATE TRIGGERS FOR DATA INTEGRITY
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_people_updated_at 
    BEFORE UPDATE ON people 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_units_updated_at 
    BEFORE UPDATE ON organizational_units 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_position_assignments_updated_at 
    BEFORE UPDATE ON position_assignments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to prevent duplicate active assignments
CREATE OR REPLACE FUNCTION check_duplicate_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        IF EXISTS (
            SELECT 1 FROM position_assignments
            WHERE person_id = NEW.person_id
            AND unit_id = NEW.unit_id
            AND position_id = NEW.position_id
            AND is_active = true
            AND id != NEW.id
        ) THEN
            RAISE EXCEPTION 'Duplicate active assignment for person % in unit %', NEW.person_id, NEW.unit_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_duplicate_assignment
    BEFORE INSERT OR UPDATE ON position_assignments
    FOR EACH ROW EXECUTE FUNCTION check_duplicate_assignment();

-- ============================================
-- 11. FINAL COMPLETION REPORT
-- ============================================

DO $$
DECLARE
    total_units INT;
    total_people INT;
    total_assignments INT;
    mc_count INT;
    buscenta_count INT;
    cell_count INT;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO total_units FROM organizational_units;
    SELECT COUNT(*) INTO total_people FROM people;
    SELECT COUNT(*) INTO total_assignments FROM position_assignments WHERE is_active = true;
    
    SELECT COUNT(*) INTO mc_count FROM organizational_units WHERE unit_type = 'MC';
    SELECT COUNT(*) INTO buscenta_count FROM organizational_units WHERE unit_type = 'BUSCENTA';
    SELECT COUNT(*) INTO cell_count FROM organizational_units WHERE unit_type = 'CELL';
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'CHURCH ORGANIZATIONAL DATABASE REBUILD COMPLETE';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'ORGANIZATION STRUCTURE:';
    RAISE NOTICE '- Total Organizational Units: %', total_units;
    RAISE NOTICE '- Ministry Centers (MCs): %', mc_count;
    RAISE NOTICE '- Buscentas: %', buscenta_count;
    RAISE NOTICE '- Cells: %', cell_count;
    RAISE NOTICE '';
    RAISE NOTICE 'PEOPLE DATA:';
    RAISE NOTICE '- Total People: %', total_people;
    RAISE NOTICE '- Active Assignments: %', total_assignments;
    RAISE NOTICE '';
    RAISE NOTICE 'AVAILABLE VIEWS:';
    RAISE NOTICE '- organizational_hierarchy: Complete organizational tree';
    RAISE NOTICE '- people_positions: All people with their positions';
    RAISE NOTICE '- mc_summary: Summary of each MC';
    RAISE NOTICE '- database_validation_report: Data quality check';
    RAISE NOTICE '';
    RAISE NOTICE 'AVAILABLE FUNCTIONS:';
    RAISE NOTICE '- promote_transfer_person(): For promotions and transfers';
    RAISE NOTICE '- get_person_history(): Get assignment history';
    RAISE NOTICE '';
    RAISE NOTICE 'VALIDATION CHECK:';
    RAISE NOTICE 'Run: SELECT * FROM database_validation_report;';
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'DATABASE IS NOW PRODUCTION READY';
    RAISE NOTICE '===========================================';
END $$;

-- ============================================
-- 12. EXAMPLE QUERIES TO VERIFY THE DATABASE
-- ============================================

-- Uncomment these to run verification queries after the script completes
/*
-- 1. Show the complete organizational hierarchy
SELECT * FROM organizational_hierarchy;

-- 2. Show summary of each MC
SELECT * FROM mc_summary;

-- 3. Show all position assignments
SELECT * FROM people_positions WHERE assignment_active = true ORDER BY unit_type, unit_name;

-- 4. Check for any data issues
SELECT * FROM database_validation_report;

-- 5. Example: Get all people in Kharis Buscenta 1
SELECT DISTINCT p.full_name, pos.title, ou.name as unit_name
FROM people p
JOIN position_assignments pa ON p.id = pa.person_id
JOIN positions pos ON pa.position_id = pos.id
JOIN organizational_units ou ON pa.unit_id = ou.id
WHERE ou.name LIKE 'Kharis Buscenta 1%'
AND pa.is_active = true
ORDER BY pos.level, p.full_name;

-- 6. Example: Get all cell shepherds
SELECT p.full_name, ou.name as cell_name
FROM people p
JOIN position_assignments pa ON p.id = pa.person_id
JOIN positions pos ON pa.position_id = pos.id AND pos.title = 'Cell Shepherd'
JOIN organizational_units ou ON pa.unit_id = ou.id
WHERE pa.is_active = true
ORDER BY ou.name;
*/

-- ============================================
-- 9. CLEANUP (REMOVE TEMPORARY COLUMNS)
-- ============================================

ALTER TABLE people DROP COLUMN IF EXISTS original_id;
ALTER TABLE organizational_units DROP COLUMN IF EXISTS original_id;

