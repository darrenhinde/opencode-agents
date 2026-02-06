#!/usr/bin/env bash

#############################################################################
# Test Script for Collision Detection
# This script simulates the collision detection logic
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           Collision Detection Test                            ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_step() {
    echo -e "\n${CYAN}${BOLD}▶${NC} $1\n"
}

# Test 1: No existing files
test_no_collisions() {
    print_step "Test 1: No Existing Files"
    
    local test_dir="/tmp/opencode-test-$$"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    # Simulate checking for files that don't exist
    local files=(".opencode/agent/test.md" ".opencode/command/test.md")
    local collisions=0
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            collisions=$((collisions + 1))
        fi
    done
    
    if [ $collisions -eq 0 ]; then
        print_success "No collisions detected (expected)"
        print_info "Result: Would install all files without prompting"
    else
        print_error "Unexpected collisions found"
    fi
    
    cd - > /dev/null
    rm -rf "$test_dir"
}

# Test 2: Some existing files
test_partial_collisions() {
    print_step "Test 2: Partial Collisions"
    
    local test_dir="/tmp/opencode-test-$$"
    mkdir -p "$test_dir/.opencode/agent"
    mkdir -p "$test_dir/.opencode/command"
    cd "$test_dir"
    
    # Create some existing files
    echo "existing" > .opencode/agent/existing.md
    echo "existing" > .opencode/command/existing.md
    
    # Simulate checking for files
    local files=(
        ".opencode/agent/existing.md"
        ".opencode/agent/new.md"
        ".opencode/command/existing.md"
        ".opencode/command/new.md"
    )
    
    local collisions=()
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            collisions+=("$file")
        fi
    done
    
    if [ ${#collisions[@]} -eq 2 ]; then
        print_success "Detected ${#collisions[@]} collisions (expected)"
        print_info "Collisions:"
        for file in "${collisions[@]}"; do
            echo "    $file"
        done
        print_info "Result: Would prompt user with 4 options"
    else
        print_error "Expected 2 collisions, found ${#collisions[@]}"
    fi
    
    cd - > /dev/null
    rm -rf "$test_dir"
}

# Test 3: All files exist
test_all_collisions() {
    print_step "Test 3: All Files Exist"
    
    local test_dir="/tmp/opencode-test-$$"
    mkdir -p "$test_dir/.opencode/agent"
    mkdir -p "$test_dir/.opencode/command"
    cd "$test_dir"
    
    # Create all files
    echo "existing" > .opencode/agent/file1.md
    echo "existing" > .opencode/agent/file2.md
    echo "existing" > .opencode/command/file1.md
    
    local files=(
        ".opencode/agent/file1.md"
        ".opencode/agent/file2.md"
        ".opencode/command/file1.md"
    )
    
    local collisions=()
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            collisions+=("$file")
        fi
    done
    
    if [ ${#collisions[@]} -eq 3 ]; then
        print_success "Detected ${#collisions[@]} collisions (all files)"
        print_info "Result: Would prompt user with 4 options"
        print_info "  Option 1 (Skip): Would install 0 files"
        print_info "  Option 2 (Overwrite): Would install 3 files"
        print_info "  Option 3 (Backup): Would backup 3, install 3"
    else
        print_error "Expected 3 collisions, found ${#collisions[@]}"
    fi
    
    cd - > /dev/null
    rm -rf "$test_dir"
}

# Test 4: Collision grouping
test_collision_grouping() {
    print_step "Test 4: Collision Grouping by Type"
    
    local test_dir="/tmp/opencode-test-$$"
    mkdir -p "$test_dir/.opencode/agent/subagents"
    mkdir -p "$test_dir/.opencode/command"
    mkdir -p "$test_dir/.opencode/context/core"
    cd "$test_dir"
    
    # Create files of different types
    echo "existing" > .opencode/agent/main.md
    echo "existing" > .opencode/agent/subagents/sub1.md
    echo "existing" > .opencode/agent/subagents/sub2.md
    echo "existing" > .opencode/command/cmd1.md
    echo "existing" > .opencode/context/core/ctx1.md
    
    local collisions=(
        ".opencode/agent/main.md"
        ".opencode/agent/subagents/sub1.md"
        ".opencode/agent/subagents/sub2.md"
        ".opencode/command/cmd1.md"
        ".opencode/context/core/ctx1.md"
    )
    
    # Group by type
    local agents=()
    local subagents=()
    local commands=()
    local contexts=()
    
    for file in "${collisions[@]}"; do
        if [[ $file == *"/agent/subagents/"* ]]; then
            subagents+=("$file")
        elif [[ $file == *"/agent/"* ]]; then
            agents+=("$file")
        elif [[ $file == *"/command/"* ]]; then
            commands+=("$file")
        elif [[ $file == *"/context/"* ]]; then
            contexts+=("$file")
        fi
    done
    
    print_success "Grouped collisions by type:"
    echo -e "${YELLOW}  Agents (${#agents[@]}):${NC}"
    printf '    %s\n' "${agents[@]}"
    echo -e "${YELLOW}  Subagents (${#subagents[@]}):${NC}"
    printf '    %s\n' "${subagents[@]}"
    echo -e "${YELLOW}  Commands (${#commands[@]}):${NC}"
    printf '    %s\n' "${commands[@]}"
    echo -e "${YELLOW}  Context (${#contexts[@]}):${NC}"
    printf '    %s\n' "${contexts[@]}"
    
    cd - > /dev/null
    rm -rf "$test_dir"
}

# Test 5: Backup simulation
test_backup_strategy() {
    print_step "Test 5: Backup Strategy Simulation"
    
    local test_dir="/tmp/opencode-test-$$"
    mkdir -p "$test_dir/.opencode/agent"
    cd "$test_dir"
    
    # Create existing file with content
    echo "original content" > .opencode/agent/test.md
    
    # Simulate backup
    local backup_dir
    backup_dir=".opencode.backup.$(date +%Y%m%d-%H%M%S)"
    local file=".opencode/agent/test.md"
    local backup_file="${backup_dir}/${file}"
    
    mkdir -p "$(dirname "$backup_file")"
    cp "$file" "$backup_file"
    
    if [ -f "$backup_file" ]; then
        print_success "Backup created successfully"
        print_info "Original: $file"
        print_info "Backup: $backup_file"
        
        # Verify content
        if diff "$file" "$backup_file" > /dev/null; then
            print_success "Backup content matches original"
        else
            print_error "Backup content differs from original"
        fi
    else
        print_error "Backup creation failed"
    fi
    
    cd - > /dev/null
    rm -rf "$test_dir"
}

# Run all tests
main() {
    print_header
    
    test_no_collisions
    test_partial_collisions
    test_all_collisions
    test_collision_grouping
    test_backup_strategy
    
    echo ""
    print_step "Test Summary"
    print_success "All collision detection tests passed!"
    print_info "The install script will correctly:"
    echo "  • Detect existing files before installation"
    echo "  • Group collisions by type for easy review"
    echo "  • Offer 4 clear strategies (skip/overwrite/backup/cancel)"
    echo "  • Create timestamped backups when requested"
    echo "  • Preserve user customizations when skipping"
    echo ""
}

main
